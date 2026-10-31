// FlowDesk MV3 — service-worker.js
// Sprint 2.1 — Queue de retry para confiabilidade de rede
// Etapa 1 (v5.2.7) — Orquestração OAuth 2.0 (Google & Microsoft) + Refresh Automático de Sessão

importScripts('auth-service.js');

/**
 * Service Worker da extensão FlowDesk.
 * Centraliza todas as chamadas fetch cross-origin e autenticação OAuth 2.0 PKCE.
 * Ações suportadas:
 *   - 'auth-login'           → Inicia login OAuth 2.0 ('google' ou 'microsoft'/'azure')
 *   - 'auth-logout'          → Encerra sessão OAuth atual
 *   - 'auth-status'          → Retorna status da sessão, usuário e Redirect URI
 *   - 'auth-test-connection' → Valida URL e Anon Key do Supabase
 *   - 'auth-update-identity' → Atualiza Nome/Equipe local e remotamente no banco
 *   - 'groq'                 → Chamada à API Groq (Llama 3.3) para revisão de texto
 *   - 'fetch-post'           → POST genérico para webhooks (telemetria, propostas) — via queue de retry
 *   - 'fetch-get'            → GET genérico
 */

// ─── ALARME DE MANUTENÇÃO DE SESSÃO OAUTH ───────────────────────────────────
const AUTH_REFRESH_ALARM = 'fd_auth_refresh_alarm';

if (chrome.alarms) {
    chrome.alarms.create(AUTH_REFRESH_ALARM, { periodInMinutes: 25 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === AUTH_REFRESH_ALARM && globalThis.AuthService) {
            globalThis.AuthService.getValidSession().catch(() => {});
        }
    });
}

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

    // ─── AUTENTICAÇÃO OAUTH 2.0 (GOOGLE & MICROSOFT) ────────────────────
    if (msg.action === 'auth-login') {
        globalThis.AuthService.signInWithOAuth(msg.provider || 'google')
            .then(res => sendResponse(res))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (msg.action === 'auth-logout') {
        globalThis.AuthService.signOut()
            .then(res => sendResponse(res))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (msg.action === 'auth-status') {
        globalThis.AuthService.getStatus()
            .then(res => sendResponse(res))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (msg.action === 'auth-test-connection') {
        globalThis.AuthService.testConnection(msg.url, msg.anonKey)
            .then(res => sendResponse(res))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (msg.action === 'auth-update-identity') {
        globalThis.AuthService.updateProfileIdentity(msg.nome, msg.equipe)
            .then(res => sendResponse(res))
            .catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    // ─── GROQ AI ────────────────────────────────────────────────────────
    if (msg.action === 'groq' || msg.action === 'FETCH_GROQ_SUGGESTION') {
        const text = msg.text || msg.payload?.prompt || '';
        const apiKey = msg.apiKey;
        const model = msg.model || 'llama-3.3-70b-versatile';
        const systemPrompt = msg.systemPrompt || 'Você é um assistente profissional de atendimento. Revise o texto mantendo o sentido original.';

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
