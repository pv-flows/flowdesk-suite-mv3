// FlowDesk MV3 — popup.js
// Sprint 1.2 — Configuração rápida de credenciais
// Etapa 1 (v5.2.7) — Suporte a sessão OAuth 2.0 (Google & Microsoft) e parse resiliente

function safeParse(val) {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (_) { return val; }
    }
    return val;
}

document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('status-operador');
    const oauthActionsEl = document.getElementById('popup-oauth-actions');
    const btnGoogle = document.getElementById('popup-btn-google');
    const btnMicrosoft = document.getElementById('popup-btn-microsoft');

    const renderIdentityStatus = async () => {
        const result = await chrome.storage.local.get(['user_nome', 'user_equipe', 'user_email', 'user_provider']);
        const nome = safeParse(result.user_nome);
        const equipe = safeParse(result.user_equipe);
        const email = safeParse(result.user_email);
        const provider = safeParse(result.user_provider);

        chrome.runtime.sendMessage({ action: 'auth-status' }, (res) => {
            if (res?.authenticated && res?.user) {
                const provLabel = (res.user.provider === 'microsoft' || res.user.provider === 'azure') ? 'Microsoft' : 'Google';
                statusEl.textContent = `☁️ ${res.user.nome} (${res.user.equipe || 'Geral'}) • ${provLabel}`;
                if (oauthActionsEl) oauthActionsEl.style.display = 'none';
            } else if (nome && equipe) {
                statusEl.textContent = email
                    ? `☁️ ${nome} - ${equipe} (${provider || 'Cloud'})`
                    : `Ativo: ${nome} - ${equipe}`;
                if (oauthActionsEl) {
                    oauthActionsEl.style.display = res?.cloudConfigured ? 'flex' : 'none';
                }
            } else {
                statusEl.textContent = `Identificar Operador (Login pendente)`;
                if (oauthActionsEl) {
                    oauthActionsEl.style.display = res?.cloudConfigured ? 'flex' : 'none';
                }
            }
        });
    };

    await renderIdentityStatus();

    const triggerPopupLogin = (provider) => {
        statusEl.textContent = `Autenticando via ${provider === 'google' ? 'Google' : 'Microsoft'}...`;
        chrome.runtime.sendMessage({ action: 'auth-login', provider }, (res) => {
            if (res?.ok) {
                renderIdentityStatus();
            } else {
                statusEl.textContent = res?.error || 'Falha ao autenticar.';
            }
        });
    };

    btnGoogle?.addEventListener('click', () => triggerPopupLogin('google'));
    btnMicrosoft?.addEventListener('click', () => triggerPopupLogin('microsoft'));

    // =========================================================================
    // CONTROLES DE INTERFACE (Sprint 8.3)
    // =========================================================================
    
    const chkTema = document.getElementById('chk-tema');
    const selFonte = document.getElementById('sel-fonte');
    const selPainel = document.getElementById('sel-painel');

    // Carregar estado atual
    const prefs = await chrome.storage.local.get(['hyper_bloco_theme', 'fd_font_size', 'fd_panel_scale']);
    chkTema.checked = prefs.hyper_bloco_theme === true;
    if (prefs.fd_font_size) selFonte.value = prefs.fd_font_size;
    if (prefs.fd_panel_scale) selPainel.value = prefs.fd_panel_scale;

    // Salvar ao alterar
    chkTema.addEventListener('change', async () => {
        await chrome.storage.local.set({ 
            hyper_bloco_theme: chkTema.checked,
            fin_painel_theme: chkTema.checked 
        });
    });

    selFonte.addEventListener('change', async () => {
        await chrome.storage.local.set({ fd_font_size: selFonte.value });
    });

    selPainel.addEventListener('change', async () => {
        await chrome.storage.local.set({ fd_panel_scale: selPainel.value });
    });

    // =========================================================================
    // CONFIGURAÇÕES AVANÇADAS (Sprint 4.2)
    // =========================================================================
    document.getElementById('btn-settings').onclick = () => chrome.runtime.openOptionsPage();
});
