// FlowDesk MV3 — popup.js
// Sprint 1.2 — Configuração rápida de credenciais

document.addEventListener('DOMContentLoaded', async () => {
    // Carregar identidade do operador parseando dados nativos do chrome.storage.local
    const result = await chrome.storage.local.get(['user_nome', 'user_equipe']);
    const nome = result.user_nome ? JSON.parse(result.user_nome) : null;
    const equipe = result.user_equipe ? JSON.parse(result.user_equipe) : null;

    const statusEl = document.getElementById('status-operador');
    if (nome && equipe) {
        statusEl.textContent = `Ativo: ${nome} - ${equipe}`;
    } else {
        statusEl.textContent = `Identificar Operador (Login pendente)`;
    }

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
