document.addEventListener('DOMContentLoaded', () => {
    if (typeof hydrateIcons === 'function') hydrateIcons();

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    initNavScroll();
    initHeroCanvas();
    initPhoneTilt();
    initFloatParallax();
    initFeatureTilt();
    initReveal();
    initChatLoop();
    initFounderInteractive();
    initServices();
});

// ─── Nav background on scroll ──────────────────────────────
function initNavScroll() {
    const nav = document.getElementById('landingNav');
    if (!nav) return;
    const onScroll = () => {
        if (window.scrollY > 40) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

// ─── Animated green-gradient blob canvas (mouse-reactive) ──
function initHeroCanvas() {
    const canvas = document.getElementById('heroCanvas');
    const hero = document.getElementById('hero');
    if (!canvas || !hero) return;
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    let w = 0, h = 0;
    function resize() {
        w = hero.offsetWidth;
        h = hero.offsetHeight;
        canvas.width = w * DPR;
        canvas.height = h * DPR;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const blobs = [
        { x: .18, y: .28, r: .34, color: 'rgba(46,181,110,0.30)', dx: 0.00012, dy: 0.00009, phase: 0 },
        { x: .78, y: .18, r: .28, color: 'rgba(111,208,154,0.22)', dx: -0.00010, dy: 0.00014, phase: 2 },
        { x: .62, y: .74, r: .38, color: 'rgba(20,120,76,0.28)', dx: 0.00008, dy: -0.00011, phase: 4 },
        { x: .12, y: .82, r: .24, color: 'rgba(217,180,91,0.14)', dx: -0.00013, dy: -0.00008, phase: 1 }
    ];

    let mouseX = 0.5, mouseY = 0.5;
    let targetMouseX = 0.5, targetMouseY = 0.5;
    hero.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect();
        targetMouseX = (e.clientX - rect.left) / rect.width;
        targetMouseY = (e.clientY - rect.top) / rect.height;
    });

    let raf = null;
    function frame(t) {
        mouseX += (targetMouseX - mouseX) * 0.03;
        mouseY += (targetMouseY - mouseY) * 0.03;

        ctx.clearRect(0, 0, w, h);
        for (const b of blobs) {
            const bx = (b.x + Math.sin(t * b.dx + b.phase) * 0.05 + (mouseX - 0.5) * 0.04) * w;
            const by = (b.y + Math.cos(t * b.dy + b.phase) * 0.05 + (mouseY - 0.5) * 0.04) * h;
            const r = b.r * Math.max(w, h);
            const grad = ctx.createRadialGradient(bx, by, 0, bx, by, r);
            grad.addColorStop(0, b.color);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.fill();
        }
        raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (!raf) raf = requestAnimationFrame(frame);
                } else if (raf) {
                    cancelAnimationFrame(raf);
                    raf = null;
                }
            });
        }, { threshold: 0.01 });
        io.observe(hero);
    }
}

// ─── 3D tilt on phone mockup in hero ────────────────────────
function initPhoneTilt() {
    const scene = document.getElementById('heroScene');
    const phone = document.getElementById('phoneMock');
    if (!scene || !phone) return;

    scene.addEventListener('mousemove', (e) => {
        const rect = scene.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        phone.style.transform = `rotateY(${px * 24}deg) rotateX(${-py * 24}deg) translateZ(30px)`;
    });
    scene.addEventListener('mouseleave', () => {
        phone.style.transform = 'rotateY(-12deg) rotateX(8deg) translateZ(0)';
    });
}

// ─── Floating stat cards parallax depth ─────────────────────
function initFloatParallax() {
    const scene = document.getElementById('heroScene');
    if (!scene) return;
    const cards = [
        { el: document.getElementById('fc1'), depth: 22 },
        { el: document.getElementById('fc2'), depth: -18 },
        { el: document.getElementById('fc3'), depth: 12 }
    ].filter(c => c.el);

    scene.addEventListener('mousemove', (e) => {
        const rect = scene.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        cards.forEach(c => {
            c.el.style.marginLeft = (px * c.depth) + 'px';
            c.el.style.marginTop = (py * c.depth * 0.6) + 'px';
        });
    });
}

// ─── Subtle 3D tilt on feature cards ────────────────────────
function initFeatureTilt() {
    const cards = document.querySelectorAll('.feature-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width - 0.5;
            const py = (e.clientY - rect.top) / rect.height - 0.5;
            card.style.transform = `rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateY(-4px)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'rotateY(0deg) rotateX(0deg) translateY(0)';
        });
    });
}

// ─── Scroll-reveal via IntersectionObserver ─────────────────
function initReveal() {
    const els = document.querySelectorAll('.reveal');
    els.forEach(el => el.classList.add('visible'));
    if (!('IntersectionObserver' in window) || els.length === 0) return;
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05 });
    els.forEach(el => io.observe(el));
}

// ─── Looping demo conversation inside the phone mockup ─────
function initChatLoop() {
    const chat = document.getElementById('phoneChat');
    if (!chat) return;

    const script = [
        { side: 'in',  text: 'Hi, I need WhatsApp automation for my real estate agency.' },
        { side: 'out', text: 'Hello Ravi! We can connect your WhatsApp in 2 mins. AI will auto-qualify buyers and book property visits.' },
        { side: 'in',  text: 'Can it score hot buyers and push them to CRM?' },
        { side: 'out', text: 'Yes! It scores budget, timeline & intent automatically (scored you 88/100!). Deal moved to Qualified.' },
        { side: 'in',  text: 'Brilliant. What is the pricing?' },
        { side: 'out', text: 'Free to get started, ₹1,499/mo for full AI lead engine. Want me to send the signup link?' }
    ];

    let running = false;
    function renderOpeningMessages() {
        chat.innerHTML = '';
        script.slice(0, 2).forEach(msg => addBubble(msg.side, msg.text));
    }

    function addBubble(side, text) {
        const b = document.createElement('div');
        b.className = `bubble bubble-${side}`;
        b.innerHTML = text + `<span class="time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
        chat.appendChild(b);
        chat.scrollTop = chat.scrollHeight;
    }

    function addTyping() {
        const b = document.createElement('div');
        b.className = 'bubble bubble-out typing';
        b.id = 'typingBubble';
        b.innerHTML = '<span></span><span></span><span></span>';
        chat.appendChild(b);
        chat.scrollTop = chat.scrollHeight;
    }

    function removeTyping() {
        const t = document.getElementById('typingBubble');
        if (t) t.remove();
    }

    async function step() {
        if (running) return;
        running = true;
        for (const msg of script.slice(2)) {
            await new Promise(r => setTimeout(r, msg.side === 'out' ? 1100 : 900));
            if (msg.side === 'out') {
                addTyping();
                await new Promise(r => setTimeout(r, 1300));
                removeTyping();
            }
            addBubble(msg.side, msg.text);
        }
        running = false;
        setTimeout(() => {
            renderOpeningMessages();
            step();
        }, 3200);
    }
    renderOpeningMessages();
    step();
}

// ─── Interactive Founder Section Highlights ─────────────────
function initFounderInteractive() {
    const pills = document.querySelectorAll('.founder-pill');
    const fipTitle = document.getElementById('fipTitle');
    const fipText = document.getElementById('fipText');
    const consultBtn = document.getElementById('openConsultModal');

    const tabData = {
        'business': {
            title: 'Proven Business Operations & Strategy',
            text: 'Years of direct operational leadership in business development, B2B sales cycles, and client growth. Translating core operational bottlenecks into streamlined, automated software architectures.'
        },
        'team': {
            title: '50+ High-Performance Team Leadership',
            text: 'Extensive track record leading cross-functional teams of 50+ across sales, customer operations, and technical delivery, fostering a culture of accountability, KPIs, and fast execution.'
        },
        'automation': {
            title: 'Custom AI Agents & WhatsApp Architectures',
            text: 'Specialized in deploying multi-tenant WhatsApp bots, Gemini-powered lead intelligence, autonomous tool-calling AI agents, and enterprise CRM integrations that scale client revenue.'
        },
        'location': {
            title: 'Based in Mumbai, Serving Global Clients',
            text: 'Headquartered in Mumbai, India, delivering world-class business consulting, custom software architectures, and automated customer engines to growing companies worldwide.'
        }
    };

    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const tabKey = pill.getAttribute('data-tab');
            const data = tabData[tabKey];
            if (data && fipTitle && fipText) {
                fipTitle.textContent = data.title;
                fipText.textContent = data.text;
            }
        });
    });

    if (consultBtn) {
        consultBtn.addEventListener('click', () => {
            // Open direct consultation WhatsApp or inquiry modal without redirecting to login
            const text = encodeURIComponent("Hi Naressh, I saw your profile on your website and would like to consult with you on WhatsApp Automation and AI solutions.");
            window.open('https://api.whatsapp.com/send?phone=919152917503&text=' + text, '_blank', 'noopener,noreferrer');
        });
    }
}

// ─── Services Section & Modal Interactivity (NO LOGIN REDIRECT) ───
const SERVICES_DATA = {
    'linkedpilot': {
        title: 'LinkedPilot',
        category: 'SaaS Automation',
        themeClass: 'theme-blue',
        icon: 'linkedin',
        desc: 'LinkedPilot is an AI Growth Operating System for LinkedIn that transforms your professional network into a repeatable growth engine by automating high-value connections and engagement.',
        fullDesc: 'LinkedPilot supercharges B2B founders, agency owners, and enterprise consultants on LinkedIn. Deploy intelligent multi-agent studios to discover high-value prospects, craft bespoke engagement hooks, schedule high-converting content, and sync warm leads directly into your CRM.',
        features: [
            '5-Agent AI Studio for personalized connection outreach',
            'Smart content scheduling & automated engagement hooks',
            'Lead CRM with Ideal Customer Profile (ICP) intent scoring',
            'Real-time response tracking & automated follow-up cadences'
        ],
        tier: 'Custom Solution'
    },
    'whatsapp-automation': {
        title: 'WhatsApp Automation',
        category: 'AI Agent',
        themeClass: 'theme-green',
        icon: 'whatsapp',
        desc: 'A unified workspace for smart WhatsApp conversations, automated follow-ups, and an organized sales workflow, leveraging AI for instant replies, lead qualification, and deal closing.',
        fullDesc: 'Turn your real WhatsApp number into a 24/7 sales engine. Context-aware AI handles inbound inquiries, quotes prices from your custom business catalog, detects hot leads, moves prospects through your pipeline, and schedules appointments automatically.',
        features: [
            'AI Chatbot with context-aware, business-aware intelligence',
            'Lead Intelligence for conversation summary, sentiment & next actions',
            'CRM Pipeline to track prospects across stages (New → Won)',
            'Instant QR-code onboarding with full multi-tenant isolation'
        ],
        tier: 'Custom Solution'
    },
    'leadfinder-ai': {
        title: 'LeadFinder AI',
        category: 'SaaS Automation',
        themeClass: 'theme-teal',
        icon: 'rocket',
        desc: 'LeadFinder AI is an enterprise B2B lead intelligence platform that instantly extracts verified local business leads and offers targeted outreach with automated pipeline syncing.',
        fullDesc: 'Quickly generate verified B2B prospect lists without expensive third-party database subscriptions. Automatically scrape, standardize phone numbers, research company context, and draft hyper-personalized cold outreach pitches powered by Gemini AI.',
        features: [
            '3-Tier Multi-Engine Scraping (0-API cost agent, Google Maps)',
            'AI-powered Cold Pitch Generation (Gemini AI personalization)',
            'Real-time Phone Parsing & Standardization (libphonenumber)',
            'One-click export into WhatsApp bulk outreach pipeline'
        ],
        tier: 'Custom Solution'
    },
    'lead-generation': {
        title: 'Lead Generation & Automation',
        category: 'Growth System',
        themeClass: 'theme-amber',
        icon: 'target',
        desc: 'Capture, qualify, organize, and nurture high-intent leads using automated multi-channel workflows, personalized outreach sequences, and real-time CRM integrations.',
        fullDesc: 'Eliminate manual prospecting and cold outreach guesswork. Build automated multi-channel capture funnels that identify buying signals, score prospect readiness, and initiate personalized conversation sequences automatically.',
        features: [
            'Automated lead capture & intent qualification criteria',
            'Personalized multi-channel outreach & follow-up sequences',
            'Direct CRM sync with real-time salesperson alert notifications',
            'A/B tested copywriting hooks and conversion rate analytics'
        ],
        tier: 'Custom Solution'
    },
    'website-development': {
        title: 'Website Development',
        category: 'Development',
        themeClass: 'theme-purple',
        icon: 'code',
        desc: 'Build modern, responsive, high-performance websites for businesses, personal brands, service providers, and startups with blazing speed and SEO optimization.',
        fullDesc: 'We architect and build tailored web applications, landing pages, and business portals engineered for high conversion, lightning performance, and seamless user experiences on desktop and mobile.',
        features: [
            'Custom modern UI with responsive cross-device layouts',
            'Blazing fast performance, accessibility & technical SEO standards',
            'API & CRM integrations, booking forms & dynamic tracking',
            'Production security hardening & robust continuous deployment'
        ],
        tier: 'Custom Solution'
    },
    'custom-ai-agents': {
        title: 'Custom AI Agents',
        category: 'AI Agent',
        themeClass: 'theme-indigo',
        icon: 'bot',
        desc: 'Develop AI agents that handle repetitive business tasks, answer customer queries, retrieve information, and execute supported workflows using connected tools.',
        fullDesc: 'Deploy goal-driven autonomous agents that connect to your business databases, internal tools, and APIs. Your custom AI agents can research, summarize, file tickets, execute transactions, and coordinate multi-step company procedures.',
        features: [
            'Autonomous business task execution & multi-agent orchestration',
            'Knowledge retrieval with private database vector search',
            'Connected tool calling & automated webhook action triggers',
            'Enterprise safety guardrails, audit logging & privacy compliance'
        ],
        tier: 'Custom Solution'
    },
    'dashboard-creation': {
        title: 'Dashboard Creation',
        category: 'Analytics',
        themeClass: 'theme-sky',
        icon: 'bar-chart-3',
        desc: 'Create interactive business dashboards for tracking leads, sales, operations, customer activity, performance metrics, and actionable automated reports.',
        fullDesc: 'Transform raw business data into actionable executive insights. We build custom real-time dashboards with visual revenue pipelines, team velocity charts, lead conversion funnels, and automated scheduled reporting.',
        features: [
            'Real-time KPI tracking & visual revenue attribution charts',
            'Interactive filters, stage conversion rates & live data feeds',
            'Multi-tenant role permissions and scheduled automated exports',
            'Unified data feeds connecting CRMs, payment gateways & analytics'
        ],
        tier: 'Custom Solution'
    },
    'voice-ai-agents': {
        title: 'Voice AI Agents',
        category: 'Voice AI',
        themeClass: 'theme-rose',
        icon: 'headset',
        desc: 'Build AI-powered voice agents for inbound and outbound calls, 24/7 customer support, lead qualification, appointment scheduling, and automated phone follow-ups.',
        fullDesc: 'Empower your business with lifelike voice agents that sound completely natural and speak without awkward delays. Handle inbound customer inquiries, qualify prospects over the phone, and schedule calendar appointments during the call.',
        features: [
            'Ultra-realistic natural human voice & conversational nuance',
            'Inbound customer service triage & call sentiment logging',
            'Direct calendar scheduling & instant WhatsApp confirmation',
            'Full telephony integration with Twilio, SIP & PBX systems'
        ],
        tier: 'Custom Solution'
    },
    'crm-development': {
        title: 'CRM Development & Automation',
        category: 'CRM System',
        themeClass: 'theme-emerald',
        icon: 'users',
        desc: 'Develop or customize CRM systems for lead management, sales pipelines, team assignments, follow-up tracking, customer records, and business reporting.',
        fullDesc: 'Replace fragmented spreadsheets with a bespoke CRM configured to your exact sales playbook. Track deal progress through visual stages, automate lead distribution among reps, and capture every customer touchpoint.',
        features: [
            'Visual Kanban pipeline stages & custom deal valuation metrics',
            'Automated lead assignment, task triggers & follow-up queues',
            'Unified conversation history & customer timeline tracking',
            'Custom reporting views, CSV imports & automated team notifications'
        ],
        tier: 'Custom Solution'
    },
    'ai-workflow-automation': {
        title: 'AI Workflow Automation',
        category: 'SaaS Automation',
        themeClass: 'theme-orange',
        icon: 'workflow',
        desc: 'Orchestrate complex cross-platform workflows, task triggers, and automated business processes to eliminate manual busywork between software tools.',
        fullDesc: 'Bridge the gaps between your billing systems, CRMs, messaging channels, and internal spreadsheets. We design resilient automated pipelines that trigger on events, validate inputs, and handle data synchronization automatically.',
        features: [
            'End-to-end multi-app workflow orchestration & triggers',
            'Smart data transformations, parsing & error recovery mechanisms',
            'Zero manual data entry & instant cross-platform background execution',
            'Custom webhooks, cron jobs & secure API authentication'
        ],
        tier: 'Custom Solution'
    },
    'ai-chatbot-development': {
        title: 'AI Chatbot Development',
        category: 'Conversational AI',
        themeClass: 'theme-yellow',
        icon: 'message-square',
        desc: 'Deliver 24/7 customer support, smart knowledge retrieval, and conversational AI tailored to your business documentation and sales playbooks.',
        fullDesc: 'Train an AI conversational bot strictly on your proprietary product docs, PDFs, support articles, and pricing sheets. Provide accurate answers in seconds across your website, WhatsApp, and social channels with human escalation.',
        features: [
            'Trained strictly on your business docs, catalog & pricing',
            'Multi-channel web widget, WhatsApp & messenger deployment',
            'Smart lead capture & seamless escalation to human agents',
            'Continuous analytics on user questions & satisfaction scores'
        ],
        tier: 'Custom Solution'
    },
    'api-business-integrations': {
        title: 'API & Business Integrations',
        category: 'Integration',
        themeClass: 'theme-red',
        icon: 'database',
        desc: 'Connect your core software stack via third-party APIs, real-time webhooks, database synchronization, and automated data processing routines.',
        fullDesc: 'Unlock data silos across your organization. We engineer bulletproof API integrations, webhook consumers, and database sync bridges connecting payment processors, marketing tools, and internal microservices.',
        features: [
            'REST, GraphQL & third-party webhook connectivity',
            'Bi-directional real-time data sync & conflict resolution',
            'Secure token authentication, retry logic & health telemetry',
            'Automated schema validations, error alerting & event logs'
        ],
        tier: 'Custom Solution'
    }
};

function initServices() {
    const filterButtons = document.querySelectorAll('.services-filter-btn');
    const serviceCards = document.querySelectorAll('.service-card');
    const modalBackdrop = document.getElementById('serviceModal');
    const modalCloseBtn = document.getElementById('closeServiceModal');
    const modalCloseFooterBtn = document.getElementById('modalCloseFooterBtn');
    const modalTitle = document.getElementById('modalServiceTitle');
    const modalBadge = document.getElementById('modalServiceBadge');
    const modalIconBox = document.getElementById('modalServiceIconBox');
    const modalDesc = document.getElementById('modalServiceDesc');
    const modalFeatures = document.getElementById('modalServiceFeatures');
    const modalWaBtn = document.getElementById('modalWhatsappBtn');
    const inquiryForm = document.getElementById('modalInquiryForm');
    const inquirySuccess = document.getElementById('inquirySuccessBanner');

    let currentSelectedService = 'WhatsApp Automation';

    // Category filter tabs
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            const targetCat = btn.getAttribute('data-filter');

            serviceCards.forEach(card => {
                const cardCat = card.getAttribute('data-category');
                if (targetCat === 'all' || cardCat === targetCat) {
                    card.style.display = 'flex';
                    card.classList.add('visible');
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    function openModalForService(serviceId) {
        const service = SERVICES_DATA[serviceId];
        if (!service || !modalBackdrop) return;
        currentSelectedService = service.title;

        if (modalTitle) modalTitle.textContent = service.title;
        if (modalBadge) {
            modalBadge.textContent = service.category;
            modalBadge.className = 'service-category-badge ' + service.themeClass;
        }
        if (modalIconBox) {
            modalIconBox.className = 'service-icon-box ' + service.themeClass;
            modalIconBox.innerHTML = typeof Icon === 'function' ? Icon(service.icon) : '';
        }
        if (modalDesc) modalDesc.textContent = service.fullDesc;
        if (modalFeatures) {
            const checkIcon = typeof Icon === 'function' ? Icon('check-circle') : '✓';
            modalFeatures.innerHTML = service.features.map(f => `
                <li>
                    <span class="feature-check">${checkIcon}</span>
                    <span>${f}</span>
                </li>
            `).join('');
        }

        if (modalWaBtn) {
            const waText = encodeURIComponent(`Hi Naressh, I would like to inquire about ${service.title} for my business.`);
            modalWaBtn.href = `https://api.whatsapp.com/send?phone=919152917503&text=${waText}`;
            modalWaBtn.setAttribute('target', '_blank');
            modalWaBtn.setAttribute('rel', 'noopener noreferrer');
            modalWaBtn.onclick = () => {
                setTimeout(closeModal, 300);
            };
        }

        if (inquirySuccess) inquirySuccess.style.display = 'none';
        if (inquiryForm) inquiryForm.reset();

        modalBackdrop.classList.add('open');
        document.body.classList.add('modal-open');
    }

    // CLICKING ON THE SERVICE CARD BOX DOES NOT REDIRECT TO LOGIN!
    serviceCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const serviceId = card.getAttribute('data-service-id') ||
                              card.querySelector('.service-cta-btn')?.getAttribute('data-service-id');
            if (serviceId) {
                openModalForService(serviceId);
            }
        });
    });

    // Handle Quick Inquiry Form Submission inside modal without redirect
    if (inquiryForm) {
        inquiryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('inquiryName')?.value || 'Client';
            const phone = document.getElementById('inquiryPhone')?.value || '';
            const msg = document.getElementById('inquiryMsg')?.value || '';

            if (inquirySuccess) {
                inquirySuccess.textContent = `Thank you ${name}! Your inquiry for ${currentSelectedService} has been noted. Naressh will reach out via WhatsApp at ${phone || 'your number'} shortly.`;
                inquirySuccess.style.display = 'block';
            }
            // Optionally open WhatsApp pre-filled as fallback
            setTimeout(() => {
                const text = encodeURIComponent(`Hi Naressh, my name is ${name}. I am inquiring about ${currentSelectedService}. ${msg}`);
                window.open(`https://api.whatsapp.com/send?phone=919152917503&text=${text}`, '_blank', 'noopener,noreferrer');
            }, 1000);
        });
    }

    function closeModal() {
        if (!modalBackdrop) return;
        modalBackdrop.classList.remove('open');
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalCloseFooterBtn) modalCloseFooterBtn.addEventListener('click', closeModal);
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) closeModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalBackdrop && modalBackdrop.classList.contains('open')) {
            closeModal();
        }
    });

    // Pagination dots interaction
    const pageDots = document.querySelectorAll('.services-pagination .page-dot');
    pageDots.forEach((dot, idx) => {
        dot.addEventListener('click', () => {
            pageDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
        });
    });

    // Explore All Services button scrolls or highlights
    const exploreBtn = document.querySelector('.services-explore-link');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const filterAll = document.querySelector('.services-filter-btn[data-filter="all"]');
            if (filterAll) filterAll.click();
            document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
        });
    }
}
