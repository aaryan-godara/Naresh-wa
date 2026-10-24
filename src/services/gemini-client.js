/**
 * gemini-client.js — the single place this codebase talks to Gemini.
 *
 * Consolidated with four specific protections:
 *
 *   1. Bounded timeouts on every call;
 *   2. Bounded retries with exponential backoff & jitter for retryable errors (429, 503, network);
 *   3. Instant model fallback across Gemini 3.x models without wasting retries on 404/unsupported models;
 *   4. Circuit breaker per API key to halt calls during sustained outages and avoid quota storms.
 */
const { GoogleGenAI } = require('@google/genai');
const crypto = require('crypto');

// ─── Gemini 3.x Model Registry ───────────────────────────────────
const GEMINI_MODELS = {
    PRIMARY: 'gemini-3.5-flash',       // Primary model for chat, workflows, chatbot
    LITE:    'gemini-3.5-flash-lite',  // Lightweight model for fast, high-volume tasks
    PRO:     'gemini-3.1-pro-preview'  // Advanced model for reasoning, lead analysis, summaries
};

const GEMINI_MODEL_LIST = [
    GEMINI_MODELS.PRIMARY,      // 'gemini-3.5-flash'
    GEMINI_MODELS.LITE,         // 'gemini-3.5-flash-lite'
    GEMINI_MODELS.PRO           // 'gemini-3.1-pro-preview'
];

const MODELS_TO_TRY = GEMINI_MODEL_LIST;

const LEGACY_MODEL_MAP = {
    'gemini-2.5-flash': GEMINI_MODELS.PRIMARY,
    'gemini-2.0-flash': GEMINI_MODELS.PRIMARY,
    'gemini-2.0-flash-lite': GEMINI_MODELS.LITE,
    'gemini-1.5-pro': GEMINI_MODELS.PRO,
    'gemini-1.5-flash': GEMINI_MODELS.PRIMARY
};

const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || 30000;
const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 1000;

// ─── Circuit breaker ────────────────────────────────────────────
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 60 * 1000;
const circuits = new Map(); // keyHash -> { failures, openedAt }

function keyFingerprint(apiKey) {
    return crypto.createHash('sha256').update(String(apiKey)).digest('hex').slice(0, 16);
}

function circuitFor(apiKey) {
    const id = keyFingerprint(apiKey);
    let c = circuits.get(id);
    if (!c) {
        c = { failures: 0, openedAt: 0 };
        circuits.set(id, c);
    }
    return c;
}

/**
 * Determines model priority order based on user settings and workflow type.
 *
 * @param {number} userId - Account ID
 * @param {string} workflowType - 'general' | 'analysis' | 'reasoning' | 'lite' | 'fast'
 * @returns {string[]} List of model identifiers to attempt in order
 */
function getModelsToAttempt(userId, workflowType = 'general') {
    const { getSetting } = require('./database');
    let configured = String(getSetting(userId, 'gemini_model') || process.env.GEMINI_MODEL || 'auto').trim();
    if (LEGACY_MODEL_MAP[configured]) {
        configured = LEGACY_MODEL_MAP[configured];
    }

    // Explicit user choice always takes highest precedence
    if (configured && configured !== 'auto' && GEMINI_MODEL_LIST.includes(configured)) {
        return [configured, ...GEMINI_MODEL_LIST.filter(m => m !== configured)];
    }

    // Automated workflow-aware multi-tier routing
    if (workflowType === 'reasoning' || workflowType === 'analysis') {
        // Deep analysis / complex reasoning
        return [GEMINI_MODELS.PRO, GEMINI_MODELS.PRIMARY, GEMINI_MODELS.LITE];
    } else if (workflowType === 'lite' || workflowType === 'fast') {
        // High-volume, fast tasks
        return [GEMINI_MODELS.LITE, GEMINI_MODELS.PRIMARY, GEMINI_MODELS.PRO];
    }
    // General chat, chatbot replies, business workflows
    return [GEMINI_MODELS.PRIMARY, GEMINI_MODELS.LITE, GEMINI_MODELS.PRO];
}

function isCircuitOpen(apiKey) {
    const c = circuitFor(apiKey);
    if (!c.openedAt) return false;
    if (Date.now() - c.openedAt > CIRCUIT_COOLDOWN_MS) {
        c.openedAt = 0;
        c.failures = CIRCUIT_FAILURE_THRESHOLD - 1;
        return false;
    }
    return true;
}

function recordFailure(apiKey) {
    const c = circuitFor(apiKey);
    c.failures++;
    if (c.failures >= CIRCUIT_FAILURE_THRESHOLD) c.openedAt = Date.now();
}

function recordSuccess(apiKey) {
    const c = circuitFor(apiKey);
    c.failures = 0;
    c.openedAt = 0;
}

function resetCircuits() {
    circuits.clear();
}

function createGeminiClient(apiKey) {
    return new GoogleGenAI({ apiKey: String(apiKey).trim() });
}

function getApiKey(userId) {
    const { getSetting } = require('./database');
    const apiKey = getSetting(userId, 'gemini_api_key') || process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here' && String(apiKey).trim() !== '') {
        return String(apiKey).trim();
    }
    return null;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** True when the error means "this key cannot be used", so stop immediately. */
function isFatalKeyError(err) {
    const msg = String(err?.message || err);
    return /\b(401|403)\b/.test(msg) || /API key not valid|permission denied|PERMISSION_DENIED|SERVICE_DISABLED|API_KEY_INVALID/i.test(msg);
}

/** True when the model is not found/supported for this API version or key. */
function isModelUnavailableError(err) {
    const msg = String(err?.message || err);
    return /\b(404)\b/.test(msg) || /not found|unsupported model|is not found for API version|MODEL_NOT_FOUND/i.test(msg);
}

/** True when rate limited. */
function isRateLimitError(err) {
    const msg = String(err?.message || err);
    return /\b(429)\b/.test(msg) || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg);
}

/**
 * Only errors a retry on the same model could plausibly fix.
 */
function isRetryableError(err) {
    if (isFatalKeyError(err)) return false;
    if (isModelUnavailableError(err)) return false;
    const msg = String(err?.message || err);
    if (/\b(400)\b/.test(msg)) return false;
    return (
        isRateLimitError(err) ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'ENOTFOUND' ||
        err?.code === 'EAI_AGAIN' ||
        /\b(500|502|503|504)\b/.test(msg) ||
        /timed out|timeout|socket hang up|network|ECONNREFUSED/i.test(msg)
    );
}

async function withTimeout(promise, ms, label = 'operation') {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Calls Gemini with timeout, bounded retry, model fallback, and circuit breaking.
 *
 * @param {number} userId
 * @param {Function} requestFn - (client, model) => Promise
 * @param {string} label - Context label for logs
 * @param {string} workflowType - 'general' | 'analysis' | 'reasoning' | 'lite'
 */
async function callGeminiWithRetry(userId, requestFn, label = 'Gemini call', workflowType = 'general') {
    const apiKey = getApiKey(userId);
    if (!apiKey) {
        const err = new Error('No Gemini API key is configured. Add your API key in Settings → Personal AI Persona.');
        err.code = 'NO_API_KEY';
        err.status = 400;
        throw err;
    }

    if (isCircuitOpen(apiKey)) {
        const err = new Error('Gemini AI is temporarily cooling down after repeated failures. Please try again in 1 minute.');
        err.code = 'AI_CIRCUIT_OPEN';
        err.status = 503;
        throw err;
    }

    const client = createGeminiClient(apiKey);
    let lastError = null;

    const modelsToAttempt = getModelsToAttempt(userId, workflowType);
    const requestedModel = modelsToAttempt[0];

    for (const model of modelsToAttempt) {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const result = await withTimeout(requestFn(client, model), GEMINI_TIMEOUT_MS, `${label} (${model})`);
                recordSuccess(apiKey);

                const fallbackOccurred = (model !== requestedModel);
                if (fallbackOccurred) {
                    console.warn(`   ⚠️ ${label}: Fallback occurred. Requested '${requestedModel}', responded with '${model}'.`);
                } else {
                    console.log(`   🤖 ${label}: Responded successfully using requested model '${model}'.`);
                }

                if (result && typeof result === 'object') {
                    result._modelUsed = model;
                    result._requestedModel = requestedModel;
                    result._fallbackOccurred = fallbackOccurred;
                }
                return result;
            } catch (err) {
                lastError = err;
                console.log(`   ⚠️ ${label}: ${model} attempt ${attempt + 1} failed - ${sanitizeError(err)}`);

                if (isFatalKeyError(err)) {
                    recordFailure(apiKey);
                    const e = new Error('The configured Gemini API key was rejected or is not authorized. Please check your key in Settings → Personal AI Persona.');
                    e.code = 'BAD_API_KEY';
                    e.status = 400;
                    throw e;
                }

                // If the model is not found / unsupported on this API key or version, fail fast to next model
                if (isModelUnavailableError(err)) {
                    console.warn(`   ⚠️ ${label}: Model '${model}' is unavailable on this API key. Falling back to next model.`);
                    break; // Move to next model immediately without retrying
                }

                if (attempt < MAX_RETRIES && isRetryableError(err)) {
                    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
                    await sleep(delay);
                    continue;
                }
                break; // move to next model
            }
        }
    }

    recordFailure(apiKey);
    const err = new Error(`All configured Gemini 3.x models failed for ${label}. Last error: ${sanitizeError(lastError)}`);
    err.code = 'AI_FAILED';
    err.status = 502;
    err.requestedModel = requestedModel;
    err.lastModel = modelsToAttempt[modelsToAttempt.length - 1];
    throw err;
}

/** Error text with anything credential-shaped stripped out. */
function sanitizeError(err) {
    const raw = String(err?.message || err || 'unknown error').split('\n')[0];
    return raw
        .replace(/key=[\w-]+/gi, 'key=[redacted]')
        .replace(/AIza[\w-]{10,}/g, '[redacted]')
        .slice(0, 300);
}

function extractText(response) {
    if (!response) return '';
    return response.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

const MAX_JSON_RESPONSE_CHARS = 200000;

function parseJsonResponse(text) {
    if (!text || typeof text !== 'string') return null;
    if (text.length > MAX_JSON_RESPONSE_CHARS) return null;
    let cleaned = text.trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    cleaned = cleaned.slice(start, end + 1);
    try {
        const parsed = JSON.parse(cleaned);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return parsed;
    } catch {
        return null;
    }
}

module.exports = {
    GEMINI_MODELS,
    GEMINI_MODEL_LIST,
    MODELS_TO_TRY,
    getModelsToAttempt,
    getApiKey,
    callGeminiWithRetry,
    extractText,
    parseJsonResponse,
    sanitizeError,
    isRetryableError,
    isFatalKeyError,
    isModelUnavailableError,
    isRateLimitError,
    isCircuitOpen,
    recordFailure,
    recordSuccess,
    resetCircuits,
    GEMINI_TIMEOUT_MS,
    MAX_RETRIES,
    CIRCUIT_FAILURE_THRESHOLD,
    CIRCUIT_COOLDOWN_MS
};
