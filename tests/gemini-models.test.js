const {
    GEMINI_MODELS,
    GEMINI_MODEL_LIST,
    MODELS_TO_TRY,
    getModelsToAttempt,
    callGeminiWithRetry,
    extractText,
    resetCircuits
} = require('../src/services/gemini-client');
const { validateSettingsPatch } = require('../src/utils/validate');
const { generateReply } = require('../src/services/ai');
const { normalizeAnalysis } = require('../src/services/lead-analyzer');

describe('Priority Gemini AI: Three Gemini 3.x Models Verification & Routing', () => {
    let testUser;
    let db;

    beforeEach(async () => {
        db = await freshDatabase();
        const account = await createUserDirect({ businessName: 'Gemini 3.x Test Biz' });
        testUser = account.user;
        resetCircuits();
    });

    test('1. Configured model registry contains exactly the three verified Gemini 3.x models', () => {
        expect(GEMINI_MODELS.PRIMARY).toBe('gemini-3.5-flash');
        expect(GEMINI_MODELS.LITE).toBe('gemini-3.5-flash-lite');
        expect(GEMINI_MODELS.PRO).toBe('gemini-3.1-pro-preview');

        expect(MODELS_TO_TRY).toEqual([
            'gemini-3.5-flash',
            'gemini-3.5-flash-lite',
            'gemini-3.1-pro-preview'
        ]);
        expect(MODELS_TO_TRY.length).toBe(3);
    });

    test('2. Default/auto configuration routes according to workflow specialization', () => {
        db.setSetting(testUser.id, 'gemini_model', 'auto');

        // General chat / WhatsApp replies / Business default to Primary Flash
        const generalChain = getModelsToAttempt(testUser.id, 'general');
        expect(generalChain[0]).toBe('gemini-3.5-flash');
        expect(generalChain).toEqual([
            'gemini-3.5-flash',
            'gemini-3.5-flash-lite',
            'gemini-3.1-pro-preview'
        ]);

        // Deep analysis / Reasoning defaults to Pro Preview
        const analysisChain = getModelsToAttempt(testUser.id, 'analysis');
        expect(analysisChain[0]).toBe('gemini-3.1-pro-preview');
        expect(analysisChain).toEqual([
            'gemini-3.1-pro-preview',
            'gemini-3.5-flash',
            'gemini-3.5-flash-lite'
        ]);

        // High-volume / Lite tasks default to Flash-Lite
        const liteChain = getModelsToAttempt(testUser.id, 'lite');
        expect(liteChain[0]).toBe('gemini-3.5-flash-lite');
        expect(liteChain).toEqual([
            'gemini-3.5-flash-lite',
            'gemini-3.5-flash',
            'gemini-3.1-pro-preview'
        ]);
    });

    test('3. Explicitly selecting gemini-3.5-flash routes requests to it first across all workflows', () => {
        db.setSetting(testUser.id, 'gemini_model', 'gemini-3.5-flash');
        const modelsGeneral = getModelsToAttempt(testUser.id, 'general');
        expect(modelsGeneral[0]).toBe('gemini-3.5-flash');

        const modelsAnalysis = getModelsToAttempt(testUser.id, 'analysis');
        expect(modelsAnalysis[0]).toBe('gemini-3.5-flash');
        expect(modelsAnalysis).toEqual([
            'gemini-3.5-flash',
            'gemini-3.5-flash-lite',
            'gemini-3.1-pro-preview'
        ]);
    });

    test('4. Explicitly selecting gemini-3.5-flash-lite routes requests to it first across all workflows', () => {
        db.setSetting(testUser.id, 'gemini_model', 'gemini-3.5-flash-lite');
        const modelsGeneral = getModelsToAttempt(testUser.id, 'general');
        expect(modelsGeneral[0]).toBe('gemini-3.5-flash-lite');

        const modelsAnalysis = getModelsToAttempt(testUser.id, 'analysis');
        expect(modelsAnalysis[0]).toBe('gemini-3.5-flash-lite');
        expect(modelsAnalysis).toEqual([
            'gemini-3.5-flash-lite',
            'gemini-3.5-flash',
            'gemini-3.1-pro-preview'
        ]);
    });

    test('5. Explicitly selecting gemini-3.1-pro-preview routes requests to it first across all workflows', () => {
        db.setSetting(testUser.id, 'gemini_model', 'gemini-3.1-pro-preview');
        const modelsGeneral = getModelsToAttempt(testUser.id, 'general');
        expect(modelsGeneral[0]).toBe('gemini-3.1-pro-preview');

        const modelsAnalysis = getModelsToAttempt(testUser.id, 'analysis');
        expect(modelsAnalysis[0]).toBe('gemini-3.1-pro-preview');
        expect(modelsAnalysis).toEqual([
            'gemini-3.1-pro-preview',
            'gemini-3.5-flash',
            'gemini-3.5-flash-lite'
        ]);
    });

    test('6. Legacy 2.x models are seamlessly mapped to Gemini 3.x counterparts without breaking user settings', () => {
        db.setSetting(testUser.id, 'gemini_model', 'gemini-2.0-flash');
        const models1 = getModelsToAttempt(testUser.id);
        expect(models1[0]).toBe('gemini-3.5-flash');

        db.setSetting(testUser.id, 'gemini_model', 'gemini-2.0-flash-lite');
        const models2 = getModelsToAttempt(testUser.id);
        expect(models2[0]).toBe('gemini-3.5-flash-lite');

        db.setSetting(testUser.id, 'gemini_model', 'gemini-2.5-flash');
        const models3 = getModelsToAttempt(testUser.id);
        expect(models3[0]).toBe('gemini-3.5-flash');
    });

    test('7. Settings schema validates gemini_model enum and upgrades legacy input', () => {
        expect(() => validateSettingsPatch({ gemini_model: 'gemini-3.5-flash' })).not.toThrow();
        expect(() => validateSettingsPatch({ gemini_model: 'gemini-3.5-flash-lite' })).not.toThrow();
        expect(() => validateSettingsPatch({ gemini_model: 'gemini-3.1-pro-preview' })).not.toThrow();
        expect(() => validateSettingsPatch({ gemini_model: 'auto' })).not.toThrow();

        // Legacy values upgrade seamlessly
        const p1 = validateSettingsPatch({ gemini_model: 'gemini-2.0-flash' });
        expect(p1.accepted.gemini_model).toBe('gemini-3.5-flash');

        const p2 = validateSettingsPatch({ gemini_model: 'gemini-2.0-flash-lite' });
        expect(p2.accepted.gemini_model).toBe('gemini-3.5-flash-lite');

        // Invalid models reject with clear validation error
        expect(() => validateSettingsPatch({ gemini_model: 'unsupported-ai-model' })).toThrow(/must be one of/i);
    });

    test('8. callGeminiWithRetry attaches model metadata and logs requested vs responding model', async () => {
        db.setSetting(testUser.id, 'gemini_api_key', 'test_valid_shaped_key');
        db.setSetting(testUser.id, 'gemini_model', 'gemini-3.5-flash');

        const mockRequestFn = jest.fn((client, model) => {
            return { text: `Hello from ${model}` };
        });

        const res = await callGeminiWithRetry(testUser.id, mockRequestFn, 'Chat reply', 'general');
        expect(res.text).toBe('Hello from gemini-3.5-flash');
        expect(res._modelUsed).toBe('gemini-3.5-flash');
        expect(res._requestedModel).toBe('gemini-3.5-flash');
        expect(res._fallbackOccurred).toBe(false);
    });

    test('9. Model unavailable (404/unsupported) fails fast to next model without wasting retries', async () => {
        db.setSetting(testUser.id, 'gemini_api_key', 'test_valid_shaped_key');
        db.setSetting(testUser.id, 'gemini_model', 'gemini-3.1-pro-preview');

        const attempts = [];
        const mockRequestFn = jest.fn((client, model) => {
            attempts.push(model);
            if (model === 'gemini-3.1-pro-preview') {
                const err = new Error('404 Model gemini-3.1-pro-preview is not found for API version v1beta');
                err.status = 404;
                throw err;
            }
            return { text: `Success from fallback model ${model}` };
        });

        const res = await callGeminiWithRetry(testUser.id, mockRequestFn, 'Preview Fallback', 'analysis');
        expect(res.text).toBe('Success from fallback model gemini-3.5-flash');
        expect(res._fallbackOccurred).toBe(true);
        expect(res._requestedModel).toBe('gemini-3.1-pro-preview');
        expect(res._modelUsed).toBe('gemini-3.5-flash');

        // Crucial: 3.1-pro-preview was attempted exactly once before failing fast to fallback
        expect(attempts.filter(m => m === 'gemini-3.1-pro-preview').length).toBe(1);
    });

    test('10. Rate limit (429) retries with backoff and falls through to next model if exhausted', async () => {
        db.setSetting(testUser.id, 'gemini_api_key', 'test_valid_shaped_key');
        db.setSetting(testUser.id, 'gemini_model', 'gemini-3.5-flash');

        const attempts = [];
        const mockRequestFn = jest.fn((client, model) => {
            attempts.push(model);
            if (model === 'gemini-3.5-flash') {
                const err = new Error('429 RESOURCE_EXHAUSTED: Quota exceeded');
                err.status = 429;
                throw err;
            }
            return { text: 'Success from flash-lite under quota limit' };
        });

        const res = await callGeminiWithRetry(testUser.id, mockRequestFn, 'Quota Fallback');
        expect(res.text).toBe('Success from flash-lite under quota limit');
        expect(res._modelUsed).toBe('gemini-3.5-flash-lite');
        expect(res._fallbackOccurred).toBe(true);
    });

    test('11. Fatal API key error aborts immediately without attempting other models or fabricating text', async () => {
        db.setSetting(testUser.id, 'gemini_api_key', 'invalid_key');
        db.setSetting(testUser.id, 'gemini_model', 'auto');

        const attemptedModels = [];
        const mockRequestFn = jest.fn((client, model) => {
            attemptedModels.push(model);
            const err = new Error('403 PERMISSION_DENIED: Gemini API has not been used in project or is disabled');
            err.status = 403;
            throw err;
        });

        await expect(callGeminiWithRetry(testUser.id, mockRequestFn, 'Fatal Key Test'))
            .rejects.toThrow(/configured Gemini API key was rejected or is not authorized/i);

        // Only 1 attempt on first model, never loops through remaining models
        expect(attemptedModels.length).toBe(1);
    });

    test('12. When all models fail, callGeminiWithRetry throws AI_FAILED and never returns fabricated text', async () => {
        db.setSetting(testUser.id, 'gemini_api_key', 'test_key');
        db.setSetting(testUser.id, 'gemini_model', 'auto');

        const mockRequestFn = jest.fn((client, model) => {
            const err = new Error(`500 Internal Server Error on ${model}`);
            err.status = 500;
            throw err;
        });

        await expect(callGeminiWithRetry(testUser.id, mockRequestFn, 'All Fail Test'))
            .rejects.toThrow(/All configured Gemini 3.x models failed/i);
    });
});
