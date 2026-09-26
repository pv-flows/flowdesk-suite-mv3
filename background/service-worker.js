// FlowDesk MV3 — service-worker.js
// Sprint 2.1 — Queue de retry para confiabilidade de rede

/**
 * Service Worker da extensão FlowDesk.
 * Centraliza todas as chamadas fetch cross-origin que content scripts não podem fazer.
 * Ações suportadas:
 *   - 'groq'       → Chamada à API Groq (Llama 3.3) para revisão de texto
 *   - 'fetch-post' → POST genérico para webhooks (telemetria, propostas) — via queue de retry
 *   - 'fetch-get'  → GET genérico
 */

// ─── QUEUE DE RETRY ─────────────────────────────────────────────────────────
const QUEUE_KEY = 'fd_pending_queue';

async function enqueue(url, body) {
    const result = await chrome.storage.local.get(QUEUE_KEY);
    const queue = result[QUEUE_KEY] || [];
    queue.push({ url, body, attempts: 0, ts: Date.now() });
    await chrome.storage.local.set({ [QUEUE_KEY]: queue });
    processQueue();
}

async function processQueue() {
    const result = await chrome.storage.local.get(QUEUE_KEY);
    const queue = result[QUEUE_KEY] || [];
    if (!queue.length) return;

    const item = queue[0];
    try {
        const res = await fetch(item.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.body)
        });
        if (res.ok) {
            queue.shift();
            await chrome.storage.local.set({ [QUEUE_KEY]: queue });
            processQueue();
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (err) {
        item.attempts++;
        if (item.attempts >= 3) {
            console.error('[FlowDesk Queue] Descartando após 3 tentativas:', item.url, err.message);
            queue.shift();
        }
        await chrome.storage.local.set({ [QUEUE_KEY]: queue });
    }
}

self.addEventListener('online', () => processQueue());
processQueue(); // processar sobras de sessão anterior
// ────────────────────────────────────────────────────────────────────────────

// ─── INJEÇÃO PROGRAMÁTICA (domínios opcionais aprovados) ──────────────────────
const CONTENT_SCRIPTS = [
    'content/config.js',
    'content/storage.js',
    'content/utils.js',
    'content/icons/lucide.js',
    'content/global-state.js',
    'content/services/toast.js',
    'content/services/modal.js',
    'content/services/holiday.js',
    'content/services/groq.js',
    'content/modules/auth.js',
    'content/modules/fin-module.js',
    'content/modules/notes-module.js',
    'content/modules/speed-dial.js',
    'content/main.js'
];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    // ─── GROQ AI ────────────────────────────────────────────────────────
    if (msg.action === 'groq') {
        const { text, apiKey, model, systemPrompt } = msg;

        fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text }
                ]
            })
        })
        .then(res => res.json())
        .then(json => {
            if (json.error) {
                sendResponse({ ok: false, error: `Groq: ${json.error.message}` });
                return;
            }
            const resultado = json.choices?.[0]?.message?.content;
            if (!resultado) {
                sendResponse({ ok: false, error: 'Groq retornou resposta vazia.' });
                return;
            }
            sendResponse({ ok: true, data: resultado.trim() });
        })
        .catch(() => {
            sendResponse({ ok: false, error: 'Erro de rede ao chamar o Groq.' });
        });

        return true; // mantém canal aberto para async
    }

    // ─── FETCH POST GENÉRICO (telemetria, propostas) — via queue de retry ─
    if (msg.action === 'fetch-post') {
        enqueue(msg.url, msg.body)
            .then(() => sendResponse({ ok: true }))
            .catch(err => sendResponse({ ok: false, error: err.message }));

        return true; // mantém canal aberto para async
    }

    if (msg.action === 'fetch-get') {
        fetch(msg.url, { method: 'GET' })
            .then(res => {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.text();
            })
            .then(data => sendResponse({ ok: true, data }))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    // ─── INJEÇÃO PROGRAMÁTICA (domínios opcionais aprovados) ─────────────
    if (msg.action === 'inject-scripts') {
        const { tabId } = msg;
        (async () => {
            try {
                for (const file of CONTENT_SCRIPTS) {
                    await chrome.scripting.executeScript({
                        target: { tabId },
                        files: [file]
                    });
                }
                sendResponse({ ok: true });
            } catch (err) {
                console.warn('[FlowDesk SW] Falha ao injetar em aba:', err.message);
                sendResponse({ ok: false, error: err.message });
            }
        })();
        return true;
    }

});

// ─── COMANDOS DE ATALHO DE TECLADO ───────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'command', cmd: command });
    }
});

// A injeção em todas as páginas e domínios customizados é orquestrada diretamente
// pelo content_scripts do manifest.json com filtro inteligente por domínio em runtime.

