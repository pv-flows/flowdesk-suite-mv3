# FlowDesk Suite Corporativa — Relatório de Auditoria e Plano de Update v6.0
**Preparado por:** Claude (Anthropic) para Paulo Victor Freire da Silva  
**Data:** Maio/2026  
**Base analisada:** FlowDesk.user.js v5.2.0 (Tampermonkey) → Extensão Chrome MV3 v5.1.7 (em progresso)  
**Escopo de operação:** 80 funcionários, SER Educacional, Recife/PE

---

## PARTE 0 — ESTADO DA MIGRAÇÃO MV3 (NOVO)

Esta seção documenta o que **já foi concluído** na extensão MV3 atual (`flowdesk-extension.zip`, v5.1.7), o que está **parcialmente implementado** e o que ainda **está pendente**. O objetivo é que o plano de update a seguir não refaça trabalho já feito.

### 0.1 — O que já está implementado no MV3

| Componente | Arquivo | Status | Observação |
|---|---|---|---|
| Manifest v3 | `manifest.json` | ✅ Completo | MV3 válido, ícones, comandos de teclado, service worker declarado |
| SafeStorage → AsyncStorage | `content/storage.js` | ✅ Completo | `chrome.storage.local` com serialização JSON, async/await nativo |
| Service Worker (proxy fetch) | `background/service-worker.js` | ✅ Completo | Suporte a `groq`, `fetch-post` e `fetch-get`; relay de comandos do teclado |
| Config centralizado | `content/config.js` | ✅ Completo | `WEBHOOK_URL`, `CONFIG_APP`, feriados fixos, blacklist de feriados |
| GlobalState | `content/global-state.js` | ✅ Completo | `isLogged`, `getIdentity`, `sendPing`, `sendProposal` — todos async via SW |
| FinModule | `content/modules/fin-module.js` | ✅ Completo | Migrado (~52KB), opera via chrome.storage |
| NotesModule | `content/modules/notes-module.js` | ✅ Completo | Migrado (~76KB), maior módulo da extensão |
| SpeedDial (FAB) | `content/modules/speed-dial.js` | ✅ Completo | Drag, posição persistida, botões de ação |
| HolidayService | `content/services/holiday.js` | ✅ Completo | Google Calendar iCal + fallback em memória |
| ModalService | `content/services/modal.js` | ✅ Completo | Modais de confirmação e prompt |
| ToastService | `content/services/toast.js` | ✅ Completo | Notificações não-bloqueantes |
| Utils | `content/utils.js` | ✅ Completo | `getVencimento3DiasUteis`, `escapeHTML`, `debounce`, `clampToViewport` |
| TamperMenu → Popup | `popup/popup.html` + `popup/popup.js` | ✅ Completo | 6 ações despachadas via `chrome.tabs.sendMessage` |
| Main / orquestrador | `content/main.js` | ✅ Completo | `TamperMenuActions`, listeners de comando, `initApp()` |
| Atalhos de teclado | `manifest.json` + `main.js` | ✅ Completo | Ctrl+1 (Financeiro), Ctrl+2 (Notas); relay via SW |
| Ícones da extensão | `icons/` | ✅ Completo | 32px, 64px, 128px claro/escuro, logotype |

### 0.2 — O que está parcialmente implementado

| Item | Situação | Detalhe |
|---|---|---|
| `content/services/groq.js` | ⚠️ Referenciado, não existe | Consta no `manifest.json` (linha `content_scripts`) e é chamado pelo `NotesModule` via `GroqService.improve()`, mas o arquivo não está presente no ZIP. A extensão **quebra no carregamento** por esse motivo. |
| Webhook sem autenticação | ⚠️ Funcional mas inseguro | `WEBHOOK_URL` hardcoded em `config.js`, exposta no bundle. Sem token de validação no Apps Script. |
| API Key Groq sem armazenamento seguro | ⚠️ Ausente | O `service-worker.js` recebe `apiKey` via mensagem do content script — a chave precisa vir de algum lugar; atualmente não está em nenhum arquivo (o arquivo `groq.js` que a definiria está faltando). |
| Login de operador sem whitelist | ⚠️ Funcional mas sem validação | Qualquer nome/equipe é aceito. Integridade da telemetria comprometida. |

### 0.3 — O que ainda não foi implementado

| Item | Sprint | Status |
|---|---|---|
| `content/services/groq.js` | Sprint 1 | ❌ Arquivo ausente — bloqueante |
| Groq API Key via `chrome.storage` (settings) | Sprint 1 | ❌ Não implementado |
| Token de autenticação no webhook | Sprint 1 | ❌ Não implementado |
| Whitelist de operadores | Sprint 1 | ❌ Não implementado |
| Queue de retry para telemetria (`background/queue.js`) | Sprint 2 | ❌ Não implementado |
| Multi-site / Site Profiles | Sprint 3 | ❌ Não implementado (manifest ainda restrito ao Hyperflow) |
| CSS externo / CSP-safe (`content/styles/`) | Sprint 3 | ❌ CSS ainda embutido em strings JS |
| MutationObserver universal para SPAs | Sprint 3 | ❌ Não implementado |
| Página de configurações (`options/settings.html`) | Sprint 4 | ❌ Não implementado |
| MacroSuggester | Sprint (extra) | ❌ Não portado do userscript original |
| Lucide Icons (substituição de emojis) | Sprint 5 | ❌ Ainda em emojis |
| Design tokens CSS (`content/styles/tokens.css`) | Sprint 5 | ❌ Não implementado |

---

## PARTE 1 — DIAGNÓSTICO DO CÓDIGO ATUAL (MV3)

### 1.1 Pontos Fortes do MV3 Atual

1. **AsyncStorage correto desde o início.** O `storage.js` usa `chrome.storage.local` com `async/await` nativamente — sem gambiarra de promisificação manual. Resolve o problema ALTO-1 do diagnóstico original antes mesmo de iniciar os sprints.

2. **Service Worker como proxy de fetch.** O `service-worker.js` já centraliza todas as chamadas cross-origin (`groq`, `fetch-post`, `fetch-get`) — a arquitetura correta para MV3. O relay de comandos de teclado também está correto.

3. **GlobalState totalmente async e sem GM.** Todas as chamadas de storage usam `SafeStorage.get/set` assíncronos e as chamadas de rede passam pelo SW via `chrome.runtime.sendMessage`. Sem vestígios de GM_*.

4. **Popup substitui TamperMenu adequadamente.** Os 6 comandos do menu antigo foram mapeados para botões no popup, com despacho correto via `sendMessage` para o content script ativo.

5. **Atalhos de teclado formalizados no manifest.** Os atalhos `Alt+1` e `Alt+'` do userscript viraram comandos declarados (`Ctrl+1`, `Ctrl+2`) com relay via service worker — padrão correto de MV3.

6. **Ícones completos.** A extensão possui todos os tamanhos necessários para a Web Store (32, 64, 128px), com variante escura/clara.

### 1.2 Problemas Críticos Remanescentes

**CRÍTICO-1: `groq.js` ausente — extensão não carrega**

O `manifest.json` lista `content/services/groq.js` em `content_scripts`, e o `NotesModule` chama `GroqService.improve()`. O arquivo não existe no pacote. Isso gera erro de carregamento do content script antes mesmo de qualquer interação do usuário.

```
// manifest.json linha content_scripts:
"content/services/groq.js",  ← arquivo não existe no ZIP
```

Prioridade máxima: a extensão está tecnicamente quebrada neste ponto.

**CRÍTICO-2: API Key Groq sem origem definida**

O `service-worker.js` corretamente recebe `apiKey` via mensagem, mas nenhum arquivo define de onde essa chave vem. O `groq.js` ausente é quem deveria lê-la do `chrome.storage.local` e passá-la para o SW. Sem esse arquivo, não há fluxo de AI funcionando.

**CRÍTICO-3: Webhook URL hardcoded e sem autenticação**

```javascript
// config.js — linha 3
const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzVWMIWL04h4mKoo8fwob1c0Z0Sqalnz2yZBRyG_6B3hcmVrWm-8p6I8cO1bn6El2xh/exec";
```

A URL completa do Apps Script está visível no bundle. Qualquer pessoa pode fazer POST diretamente na planilha de telemetria com dados arbitrários. Em MV3, o bundle é legível por qualquer usuário que acesse `chrome://extensions` em modo desenvolvedor.

**CRÍTICO-4: Login sem validação de identidade**

O popup exibe o operador logado mas qualquer pessoa pode digitar qualquer nome no prompt de login, incluindo o nome de um colega. Os dados de telemetria na planilha ficam comprometidos. Não há lista de operadores válidos configurada.

**ALTO-1: Emojis como ícones funcionais**

O popup usa emojis (`1️⃣`, `2️⃣`...) e os módulos usam emojis para botões funcionais (fechar, macros, agenda). Em Windows com escala de DPI >125% ou perfis de acessibilidade, o rendering quebra o layout — especialmente em botões com tamanho definido em pixels.

**ALTO-2: CSS inline (strings JS) — vulnerável a CSP**

Todos os estilos dos módulos são injetados via `getStyles()` retornando strings de template literal inseridas com `innerHTML`. Sites com `Content-Security-Policy: style-src 'self'` bloqueiam esse padrão silenciosamente, tornando a extensão sem estilo.

**MÉDIO-1: Sem retry de rede para telemetria**

`sendPing` e `sendProposal` fazem uma chamada única via SW. Se a rede falhar (conexão instável, que é comum em ambientes de call center), o registro é perdido silenciosamente. Para 80 operadores, isso resulta em lacunas na planilha de métricas.

**MÉDIO-2: Extensão restrita ao Hyperflow**

O `manifest.json` ainda declara `matches: ["https://conversas.hyperflow.global/*"]`. Isso impede que o MacroSuggester (pendente de portagem) funcione em outros sites como WhatsApp Web ou Gmail, uso real identificado na operação.

---

## PARTE 2 — REFERÊNCIAS DE MERCADO

Antes de implementar, use essas extensões como benchmark visual e funcional. Todas estão na Chrome Web Store:

**Para parâmetro de UI de painel flutuante:**
- **Loom** — Painel flutuante durante gravação. Referência de drag, posição persistida, tema escuro/claro, botões com ícones Lucide. Exatamente o padrão que o FlowDesk deve atingir.
- **Grammarly** — FAB com menu expansível. Referência direta para o Speed Dial. Analise como o FAB deles persiste posição entre sites.

**Para parâmetro de settings page:**
- **Bardeen** — Extensão de automação com página de configurações dedicada (`options.html`). Referência de organização de seções: Conta, Aparência, Atalhos, Backup/Restore, Sobre.
- **Momentum** — Página de configurações com toggle de tema, font size, personalização visual. UI clean, sem frameworks pesados.

**Para parâmetro de autenticação:**
- **Notion Web Clipper** — Usa o fluxo de OAuth do Google (`chrome.identity`). Analise o fluxo: clique no popup → redirect → token salvo → acesso liberado.
- **Forest** — Autenticação por email simples (sem OAuth). Referência para o fluxo alternativo mais leve.

**Para parâmetro de ícones e design system:**
- **Linear** (extensão) — Usa Lucide Icons com tamanho 16px e stroke-width 1.5. O padrão mais elegante disponível.

---

## PARTE 3 — PLANO DE IMPLEMENTAÇÃO v6.0

O update é dividido em **5 Sprints**, ordenados por criticidade. Os Sprints 2 a 5 só devem ser iniciados após o Sprint 1 estar estável em produção, pois o CRÍTICO-1 (groq.js ausente) torna a extensão não-funcional hoje.

---

### SPRINT 1 — SEGURANÇA E CORREÇÃO CRÍTICA (Prioridade: BLOQUEANTE)
**Objetivo:** Fazer a extensão funcionar corretamente e eliminar os críticos de segurança antes de qualquer novo deploy para 80 usuários.

#### 1.1 Criar `content/services/groq.js` (BUG BLOQUEANTE)

Este arquivo deve: (1) ler a API Key do `chrome.storage.local`, (2) encaminhar a chamada ao service worker, (3) expor `globalThis.GroqService`.

```javascript
// content/services/groq.js
if (!globalThis.GroqService) {

globalThis.GroqService = {
    /**
     * Envia texto para revisão via Groq (Llama 3.3) através do service worker.
     * @param {string} text - Texto a ser revisado
     * @param {Function} onSuccess - Callback com o texto revisado
     * @param {Function} onError - Callback de erro
     */
    improve: async (text, onSuccess, onError) => {
        const { groq_api_key } = await chrome.storage.local.get('groq_api_key');

        if (!groq_api_key) {
            onError?.('Chave Groq não configurada. Acesse o Menu > Configurações.');
            return;
        }

        chrome.runtime.sendMessage({
            action: 'groq',
            text,
            apiKey: groq_api_key,
            model: 'llama-3.3-70b-versatile',
            systemPrompt: 'Você é um assistente de atendimento educacional. Revise o texto a seguir corrigindo gramática e tornando-o mais profissional, mantendo o sentido original. Retorne apenas o texto revisado, sem explicações.'
        }, (response) => {
            if (chrome.runtime.lastError) {
                onError?.('Erro de comunicação com o service worker.');
                return;
            }
            if (response?.ok) {
                onSuccess?.(response.data);
            } else {
                onError?.(response?.error || 'Erro desconhecido ao chamar Groq.');
            }
        });
    }
};

}
```

Adicionar ao `manifest.json` na seção `content_scripts` (já está declarado, só o arquivo faltava):
```json
"content/services/groq.js"
```

#### 1.2 Groq API Key via chrome.storage (Remover do Bundle)

A chave **nunca deve aparecer em nenhum arquivo do bundle**. O fluxo correto:

1. Admin configura a chave uma vez via popup ou settings page (Sprint 4).
2. A chave fica em `chrome.storage.local` com a key `groq_api_key`.
3. O `groq.js` lê de lá antes de cada chamada — sem hardcode em nenhum ponto.

**Solução temporária** (até o Sprint 4 entregar a settings page): adicionar um botão de configuração rápida no popup existente.

Em `popup/popup.html`, adicionar antes do `</body>`:
```html
<div id="groq-config" style="margin-top:8px; border-top:1px solid #e2e8f0; padding-top:8px;">
  <input type="password" id="input-groq-key" placeholder="Groq API Key (gsk_...)"
    style="width:100%; box-sizing:border-box; padding:6px; border:1px solid #e2e8f0; border-radius:4px; font-size:11px; margin-bottom:4px;">
  <button class="btn" id="btn-salvar-groq">Salvar Chave Groq</button>
</div>
```

Em `popup/popup.js`, adicionar ao final do `DOMContentLoaded`:
```javascript
// Carregar chave mascarada
const { groq_api_key } = await chrome.storage.local.get('groq_api_key');
if (groq_api_key) {
    document.getElementById('input-groq-key').placeholder = 'Chave configurada ✓';
}

document.getElementById('btn-salvar-groq').onclick = async () => {
    const key = document.getElementById('input-groq-key').value.trim();
    if (!key.startsWith('gsk_')) {
        alert('Chave inválida. Deve começar com gsk_');
        return;
    }
    await chrome.storage.local.set({ groq_api_key: key });
    document.getElementById('input-groq-key').value = '';
    document.getElementById('input-groq-key').placeholder = 'Chave configurada ✓';
};
```

#### 1.3 Proteger o Webhook do Apps Script

Mover a `WEBHOOK_URL` para `chrome.storage.local` e adicionar token de autenticação.

**No Apps Script** (`doPost`), adicionar validação de token:
```javascript
const SECRET_TOKEN = 'FLOWDESK_2026'; // token compartilhado internamente

function doPost(e) {
    const payload = JSON.parse(e.postData.contents);
    if (payload.token !== SECRET_TOKEN) {
        return ContentService
            .createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
            .setMimeType(ContentService.MimeType.JSON);
    }
    // ... lógica de registro existente
}
```

**Em `config.js`**, remover a URL hardcoded e substituir por uma constante vazia:
```javascript
// WEBHOOK_URL foi removido do bundle por segurança.
// Configure via popup ou settings page.
const WEBHOOK_DEFAULTS = {
    TOKEN: 'FLOWDESK_2026' // token pode ficar aqui (não é segredo, só impede POSTs acidentais)
};
globalThis.WEBHOOK_DEFAULTS = WEBHOOK_DEFAULTS;
```

**Em `global-state.js`**, atualizar `sendPing` e `sendProposal` para ler a URL do storage:
```javascript
sendPing: async (tipoAcao, metodoPagto, valor = 0) => {
    const { webhook_url } = await chrome.storage.local.get('webhook_url');
    if (!webhook_url) return; // sem URL configurada, ignora silenciosamente

    const ident = await globalThis.GlobalState.getIdentity();
    chrome.runtime.sendMessage({
        action: 'fetch-post',
        url: webhook_url,
        body: {
            token: globalThis.WEBHOOK_DEFAULTS.TOKEN,
            operador: ident.nome,
            equipe: ident.equipe,
            tipo_acao: tipoAcao,
            metodo_pagto: metodoPagto,
            valor: valor
        }
    });
},
```

**No popup**, adicionar campo de configuração da URL (junto com o da chave Groq acima):
```javascript
// Salvar webhook URL
document.getElementById('btn-salvar-webhook').onclick = async () => {
    const url = document.getElementById('input-webhook-url').value.trim();
    await chrome.storage.local.set({ webhook_url: url });
};
```

#### 1.4 Whitelist de Operadores

Adicionar validação de identidade para proteger a integridade da planilha de telemetria.

Criar `content/modules/auth.js`:
```javascript
// FlowDesk MV3 — auth.js
if (!globalThis.AuthModule) {

globalThis.AuthModule = {
    /**
     * Valida operador contra whitelist configurada pelo admin.
     * Se não houver whitelist, aceita qualquer nome (modo livre).
     */
    validate: async (nome, equipe) => {
        const { operadores_whitelist } = await chrome.storage.local.get('operadores_whitelist');
        if (!operadores_whitelist || operadores_whitelist.length === 0) return true;
        return operadores_whitelist.some(
            op => op.nome.toLowerCase() === nome.toLowerCase() &&
                  op.equipe.toLowerCase() === equipe.toLowerCase()
        );
    },

    /**
     * Retorna lista de equipes disponíveis para o select de login.
     */
    getEquipes: async () => {
        const { operadores_whitelist } = await chrome.storage.local.get('operadores_whitelist');
        if (!operadores_whitelist) return ['Digital', 'Presencial', 'Receptivo'];
        return [...new Set(operadores_whitelist.map(op => op.equipe))];
    }
};

}
```

Adicionar ao `manifest.json` em `content_scripts`, antes de `main.js`:
```json
"content/modules/auth.js"
```

Integrar no fluxo de login do `FinModule` (ou onde o overlay de login está implementado):
```javascript
// Na função de confirmação de login
const valido = await globalThis.AuthModule.validate(nome, equipe);
if (!valido) {
    ToastService.error('Operador não reconhecido. Contate o administrador.');
    return;
}
```

---

### SPRINT 2 — CONFIABILIDADE DE REDE (Prioridade: ALTA)
**Objetivo:** Garantir que nenhum dado de telemetria seja perdido por falha de rede.

> **Nota:** O `SafeStorage` já é assíncrono e correto no MV3 atual. O Sprint 2 do relatório original (migração para AsyncStorage) já está concluído. Este sprint foca apenas no que ainda falta: a fila de retry.

#### 2.1 Queue de Retry para Telemetria

Criar `background/queue.js` e importar no `service-worker.js`:

```javascript
// background/queue.js
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
        } else {
            item.attempts++;
            if (item.attempts >= 3) queue.shift();
        }
    } catch {
        item.attempts++;
        if (item.attempts >= 3) queue.shift();
    }
    await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

// Tentar reprocessar quando a rede voltar
self.addEventListener('online', processQueue);

// Processar ao iniciar o service worker (ex: após browser restart)
processQueue();
```

Em `service-worker.js`, substituir o handler `fetch-post` por:
```javascript
if (msg.action === 'fetch-post') {
    enqueue(msg.url, msg.body)
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
}
```

---

### SPRINT 3 — MULTI-SITE E RESILIÊNCIA CSP (Prioridade: ALTA)
**Objetivo:** Expandir a extensão para funcionar em outros sites e tornar o CSS robusto contra Content Security Policy.

#### 3.1 Site Profiles em `config.js`

O `config.js` atual já tem a estrutura correta (`CONFIG_APP`, constantes globais). Adicionar `SITE_PROFILES` e `getCurrentProfile()`:

```javascript
// Adicionar ao config.js existente
const SITE_PROFILES = {
    'conversas.hyperflow.global': {
        name: 'Hyperflow',
        enableFinModule: true,
        enableNotesModule: true,
        enableMacroSuggester: true,
        enableTelemetry: true,
    },
    'web.whatsapp.com': {
        name: 'WhatsApp Web',
        enableFinModule: false,
        enableNotesModule: true,
        enableMacroSuggester: true,
        enableTelemetry: false,
    },
    'mail.google.com': {
        name: 'Gmail',
        enableFinModule: false,
        enableNotesModule: true,
        enableMacroSuggester: true,
        enableTelemetry: false,
    },
    'default': {
        name: 'Genérico',
        enableFinModule: false,
        enableNotesModule: true,
        enableMacroSuggester: true,
        enableTelemetry: false,
    }
};

function getCurrentProfile() {
    return SITE_PROFILES[location.hostname] || SITE_PROFILES['default'];
}

globalThis.SITE_PROFILES = SITE_PROFILES;
globalThis.getCurrentProfile = getCurrentProfile;
```

Em `main.js`, usar o perfil para condicionar a inicialização:
```javascript
const initApp = async () => {
    const profile = globalThis.getCurrentProfile();

    if (profile.enableFinModule) await FinModule.init();
    if (profile.enableNotesModule) await NotesModule.init();
    if (profile.enableMacroSuggester && globalThis.MacroSuggester) MacroSuggester.init();

    SpeedDial.init();
    window.addEventListener('resize', clampAllElementsToViewport);
    // ... resto do initApp atual
};
```

#### 3.2 Manifest.json — Permissões Multi-site

```json
"content_scripts": [{
    "matches": ["<all_urls>"],
    "js": [
        "content/config.js",
        "content/storage.js",
        "content/utils.js",
        "content/global-state.js",
        "content/services/toast.js",
        "content/services/modal.js",
        "content/services/holiday.js",
        "content/services/groq.js",
        "content/modules/auth.js",
        "content/modules/fin-module.js",
        "content/modules/notes-module.js",
        "content/modules/speed-dial.js",
        "content/main.js"
    ],
    "run_at": "document_idle"
}]
```

Adicionar `web_accessible_resources` para os CSS externos (Sprint 3.3):
```json
"web_accessible_resources": [{
    "resources": ["content/styles/*.css"],
    "matches": ["<all_urls>"]
}]
```

**Justificativa para a Web Store:** "A extensão precisa estar disponível nos sites de atendimento usados pelos operadores (Hyperflow, WhatsApp Web, Gmail, intranet) pois o MacroSuggester de macros de texto precisa funcionar em qualquer contexto de atendimento."

#### 3.3 CSS Externo (CSP-Safe)

Criar pasta `content/styles/` e extrair os CSS embutidos nos módulos para arquivos separados. Em `main.js`, injetar via `<link>` ao invés de `<style>`:

```javascript
function injectStyles(cssFile) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL(`content/styles/${cssFile}`);
    document.head.appendChild(link);
}

// Na initApp, antes de inicializar os módulos:
injectStyles('tokens.css');
injectStyles('fin-module.css');
injectStyles('notes-module.css');
injectStyles('speed-dial.css');
```

Arquivos a criar extraindo os `getStyles()` de cada módulo:
- `content/styles/tokens.css` — variáveis de design system (cores, sombras, border-radius)
- `content/styles/fin-module.css`
- `content/styles/notes-module.css`
- `content/styles/speed-dial.css`
- `content/styles/macro-suggester.css` (quando o MacroSuggester for portado)

#### 3.4 MutationObserver para SPAs

O `main.js` atual tem `initApp()` simples. Adicionar re-injeção resiliente para SPAs (o Hyperflow é React e pode desmontar o DOM):

```javascript
// Ao final do main.js, após initApp()
const routeObserver = new MutationObserver(debounce(() => {
    const profile = globalThis.getCurrentProfile();
    if (profile.enableFinModule && !document.getElementById('abrir-painel')) {
        console.log('[FlowDesk] DOM reset detectado — reinjetando módulos...');
        initApp();
    }
}, 800));

if (document.body) {
    routeObserver.observe(document.body, { childList: true, subtree: false });
}
```

---

### SPRINT 4 — PÁGINA DE CONFIGURAÇÕES (Prioridade: ALTA)
**Objetivo:** Substituir os campos de configuração no popup por uma página dedicada e profissional.

#### 4.1 Estrutura da Página

Criar `options/settings.html` e `options/settings.js`.

**Seções:**
1. **Identidade** — Nome e equipe do operador; select com equipes da whitelist
2. **Segurança** — Campo para Groq API Key, campo para Webhook URL, gerenciamento da whitelist de operadores
3. **Aparência** — Tema padrão (claro/escuro), tamanho de fonte base (12px/13px/14px/16px)
4. **Sites Ativos** — Toggle por site padrão + campo para adicionar domínio customizado
5. **Backup e Restauração** — Exportar JSON, importar JSON, limpar histórico, reset de fábrica
6. **Sobre** — Versão, autor, link de suporte

Declarar no `manifest.json`:
```json
"options_ui": {
    "page": "options/settings.html",
    "open_in_tab": true
}
```

#### 4.2 Botão de Settings no Popup

Em `popup/popup.html`, substituir o bloco de configuração rápida criado no Sprint 1 pelo botão:
```html
<button class="btn" id="btn-settings" style="margin-top:8px; border-top:1px solid #e2e8f0; padding-top:8px;">
  ⚙ Configurações Avançadas
</button>
```

Em `popup/popup.js`:
```javascript
document.getElementById('btn-settings').onclick = () => {
    chrome.runtime.openOptionsPage();
};
```

---

### SPRINT 5 — MODERNIZAÇÃO DE ÍCONES E UI (Prioridade: MÉDIA)
**Objetivo:** Substituir emojis por Lucide Icons SVG inline para consistência cross-OS.

#### 5.1 Bundle Local de Ícones Lucide

Criar `content/icons/lucide.js` com apenas os ícones efetivamente usados (sem dependência de CDN):

```javascript
// content/icons/lucide.js
if (!globalThis.LucideIcons) {

const icons = {
    plus: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    fileText: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    dollarSign: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    sun: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
    moon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    zap: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    calendar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    clipboard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
    undo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`,
    trash2: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
    settings: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    sparkles: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5z"/></svg>`
};

globalThis.LucideIcons = {
    get: (name, size = 16) => {
        const svg = icons[name];
        if (!svg) return '';
        return svg
            .replace(/width="\d+"/, `width="${size}"`)
            .replace(/height="\d+"/, `height="${size}"`);
    }
};

}
```

#### 5.2 Mapeamento Emoji → Lucide

| Emoji atual | Lucide Icon | Onde substituir |
|---|---|---|
| ➕ | `plus` | Speed Dial FAB — ícone principal |
| 💰 | `dollar-sign` | Botão SD Financeiro |
| 📝 | `file-text` | Botão SD Notas |
| ✕ / ✗ | `x` | Fechar painéis |
| ☀️ | `sun` | Toggle tema claro |
| 🌙 | `moon` | Toggle tema escuro |
| ⚡ | `zap` | Macros |
| 📅 | `calendar` | Agenda |
| 📋 | `clipboard` | Histórico / Copiar |
| ↩ | `undo` | Desfazer |
| 🗑️ | `trash-2` | Excluir |
| ✨ | `sparkles` | IA / Melhorar |
| 1️⃣ 2️⃣ 3️⃣... | texto simples | Popup — remover emojis de número |

#### 5.3 Design Tokens CSS

Criar `content/styles/tokens.css` com todas as variáveis compartilhadas:

```css
:root {
    /* Cores */
    --fd-primary: #6b46c1;
    --fd-primary-hover: #553c9a;
    --fd-bg: #ffffff;
    --fd-bg-secondary: #f7fafc;
    --fd-border: #e2e8f0;
    --fd-text: #1a202c;
    --fd-text-muted: #718096;
    --fd-danger: #e53e3e;
    --fd-success: #38a169;

    /* Tipografia */
    --fd-font-family: 'Inter', system-ui, -apple-system, sans-serif;
    --fd-font-size-base: 13px;
    --fd-font-size-sm: calc(var(--fd-font-size-base) - 1px);
    --fd-font-size-lg: calc(var(--fd-font-size-base) + 2px);

    /* Espaçamento e forma */
    --fd-radius: 8px;
    --fd-radius-sm: 4px;
    --fd-shadow: 0 4px 15px rgba(107, 70, 193, 0.15);
    --fd-shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.12);
}

/* Tema escuro */
[data-fd-theme="dark"] {
    --fd-bg: #1a202c;
    --fd-bg-secondary: #2d3748;
    --fd-border: #4a5568;
    --fd-text: #f7fafc;
    --fd-text-muted: #a0aec0;
}
```

---

## PARTE 4 — ROADMAP CONSOLIDADO

### Sequência de Implementação

```
SPRINT 1 (Semana 1) — SEGURANÇA E CORREÇÃO CRÍTICA  [BLOQUEANTE]
├── 1.1 Criar content/services/groq.js (extensão está quebrada sem isso)
├── 1.2 Groq API Key via chrome.storage (campo no popup como solução temp.)
├── 1.3 Webhook protegido com token + URL fora do bundle
└── 1.4 auth.js — whitelist de operadores

SPRINT 2 (Semana 2) — CONFIABILIDADE DE REDE
└── 2.1 background/queue.js — fila de retry para telemetria

SPRINT 3 (Semana 2-3) — MULTI-SITE E CSP
├── 3.1 SITE_PROFILES + getCurrentProfile() em config.js
├── 3.2 Manifest.json — <all_urls> + web_accessible_resources
├── 3.3 CSS externo (content/styles/) + injectStyles()
└── 3.4 MutationObserver para re-injeção em SPAs

SPRINT 4 (Semana 3) — SETTINGS PAGE
├── 4.1 options/settings.html + settings.js (6 seções)
└── 4.2 Botão "Configurações Avançadas" no popup

SPRINT 5 (Semana 4) — MODERNIZAÇÃO UI
├── 5.1 content/icons/lucide.js — bundle local de SVGs
├── 5.2 Substituição emoji → Lucide em todos os módulos
└── 5.3 content/styles/tokens.css — design tokens consolidados

SPRINT EXTRA — MacroSuggester (após Sprint 3)
└── Portar MacroSuggester do userscript original para o MV3

DEPLOY BETA (Semana 5)
├── Teste com 5 operadores piloto
├── Coleta de feedback estruturado
└── Hotfixes

DEPLOY PRODUÇÃO (Semana 6)
└── Rollout completo (80 operadores)
```

---

## PARTE 5 — ESTRUTURA DE ARQUIVOS FINAL (v6.0)

```
flowdesk-extension/
│
├── manifest.json                    ← Atualizar: <all_urls>, web_accessible_resources, options_ui
│
├── background/
│   ├── service-worker.js            ✅ Existente — adicionar integração com queue.js
│   └── queue.js                     ← NOVO: fila de envio com retry automático
│
├── content/
│   ├── main.js                      ✅ Existente — adicionar profile routing e MutationObserver
│   ├── config.js                    ✅ Existente — adicionar SITE_PROFILES, remover WEBHOOK_URL hardcoded
│   ├── global-state.js              ✅ Existente — atualizar sendPing/sendProposal para ler URL do storage
│   ├── storage.js                   ✅ Existente — nenhuma alteração necessária
│   ├── utils.js                     ✅ Existente — nenhuma alteração necessária
│   │
│   ├── styles/                      ← NOVO: CSS externo (CSP-safe)
│   │   ├── tokens.css               ← NOVO: variáveis de design system
│   │   ├── fin-module.css           ← NOVO: extraído de fin-module.js
│   │   ├── notes-module.css         ← NOVO: extraído de notes-module.js
│   │   ├── speed-dial.css           ← NOVO: extraído de speed-dial.js
│   │   └── macro-suggester.css      ← NOVO: para quando MacroSuggester for portado
│   │
│   ├── icons/
│   │   └── lucide.js                ← NOVO: bundle de ícones SVG Lucide
│   │
│   ├── modules/
│   │   ├── fin-module.js            ✅ Existente — extrair CSS, substituir emojis
│   │   ├── notes-module.js          ✅ Existente — extrair CSS, substituir emojis
│   │   ├── speed-dial.js            ✅ Existente — extrair CSS, substituir emojis
│   │   └── auth.js                  ← NOVO: whitelist de operadores
│   │
│   └── services/
│       ├── holiday.js               ✅ Existente — nenhuma alteração necessária
│       ├── modal.js                 ✅ Existente — nenhuma alteração necessária
│       ├── toast.js                 ✅ Existente — nenhuma alteração necessária
│       └── groq.js                  ← NOVO (CRÍTICO): arquivo ausente que quebra a extensão
│
├── options/                         ← NOVO: página de configurações
│   ├── settings.html
│   ├── settings.js
│   └── settings.css
│
├── popup/
│   ├── popup.html                   ✅ Existente — adicionar campo config rápida (Sprint 1) / botão settings (Sprint 4)
│   └── popup.js                     ✅ Existente — adicionar handlers de configuração
│
└── icons/                           ✅ Completo — nenhuma alteração necessária
    ├── flowdesk-128x128-claro.png
    ├── flowdesk-128x128-escuro.png
    ├── flowdesk-32x32.png
    ├── flowdesk-64x64.png
    └── flowdesk-logotype.png
```

**Legenda:** ✅ Existente e funcional | ← NOVO | ← NOVO (CRÍTICO)

---

## PARTE 6 — CRITÉRIOS DE QUALIDADE CHROME WEB STORE

Para manter a extensão publicada sem risco de remoção:

**Permissões mínimas necessárias** (justificar no formulário da store):
```json
"permissions": [
    "storage",         // Salvar configurações, histórico e chaves de API
    "activeTab"        // Despachar ações do popup para a aba ativa
],
"host_permissions": [
    "<all_urls>",                               // Multi-site: MacroSuggester em qualquer site corporativo
    "https://api.groq.com/*",                   // Chamadas à AI de revisão de texto
    "https://script.google.com/*",             // Telemetria via Google Apps Script
    "https://calendar.google.com/*",           // Cache de feriados
    "https://www.generativelanguage.googleapis.com/*"  // Fallback AI (se usado)
]
```

**O que NÃO fazer (riscos de ban):**
- Não usar `eval()` em nenhum contexto
- Não fazer fetch para domínios não declarados em `host_permissions`
- Não injetar scripts remotos (CDN em runtime)
- Não usar `document.write()`
- Não ter API keys visíveis no bundle (resolvido no Sprint 1)

**O que o revisor vai verificar:**
1. Cada permissão deve ter justificativa clara no formulário de submissão
2. O código não pode conter API keys hardcoded (após Sprint 1, resolvido)
3. A privacy policy deve mencionar: nome do operador, equipe, métricas de uso (tipo de ação, valor de proposta)

---

## PARTE 7 — PRÓXIMOS PASSOS

1. **Sprint 1 é bloqueante** — a extensão está tecnicamente quebrada pelo `groq.js` ausente. Iniciar por ele.

2. **Para cada Sprint, o prompt Antigravity será gerado** — formatado com contexto exato do arquivo a modificar, código antes e depois, sem reescritas totais.

3. **Debugging:** Para cada erro reportado da Antigravity, trazer aqui com o stack trace para correção cirúrgica.

4. **Após cada Sprint:** revisão de integração antes de avançar ao próximo.

---

*FlowDesk v6.0 — Construído para durar, projetado para 80 operadores, arquitetado para crescer.*
