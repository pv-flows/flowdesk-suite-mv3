// FlowDesk MV3 — main.js
// Sprint 3.4 — MutationObserver SPA re-injection

/**
 * Lógica baseada no TamperMenu, agora orquestrada via background messages 
 * disparadas pelos cliques no Popup da extensão.
 */
if (!globalThis._flowdeskMainInitialized) {
globalThis._flowdeskMainInitialized = true;

const TamperMenuActions = {
    async resetPositions() {
        const posData = await SafeStorage.get('fd_panel_positions', { fin: 'top-right', notes: 'top-left' });

        const painelFin = document.getElementById('painel-financeiro');
        if (painelFin) {
            if (globalThis.applyPanelPosition) {
                globalThis.applyPanelPosition(painelFin, posData?.fin || 'top-right');
            } else {
                painelFin.style.top = '10px';
                painelFin.style.right = '10px';
                painelFin.style.left = 'auto';
                painelFin.style.bottom = 'auto';
            }
            painelFin.style.display = 'flex';
        }

        const btnFloat = document.getElementById('abrir-painel');
        if (btnFloat) {
            btnFloat.style.bottom = '80px';
            btnFloat.style.left = '15px';
            btnFloat.style.top = 'auto';
            btnFloat.style.right = 'auto';
            btnFloat.style.transform = 'scale(1)';
        }

        const painelNote = document.getElementById('bloco-notas');
        if (painelNote) {
            if (globalThis.applyPanelPosition) {
                globalThis.applyPanelPosition(painelNote, posData?.notes || 'top-left');
            } else {
                painelNote.style.top = '10px';
                painelNote.style.left = '10px';
            }
            painelNote.style.width = '350px';
            painelNote.style.height = '375px';
        }

        await SafeStorage.set(CONFIG_APP.STORAGE_POS, null);

        ToastService.success("✅ Janelas realinhadas para o padrão!");
    },

    resetToDefaults() {
        ModalService.confirm("Resetar tudo?", "Tem certeza que deseja resetar todas as configurações e cookies para o padrão? Esta ação é irreversível.", async () => {
            await SafeStorage.set(CONFIG_APP.STORAGE_DATA, null);
            await SafeStorage.set(CONFIG_APP.STORAGE_POS, null);
            await SafeStorage.set('fd_panel_positions', null);
            await SafeStorage.set(CONFIG_APP.STORAGE_MACROS, null);
            await SafeStorage.set(CONFIG_APP.STORAGE_AGENDA, null);
            await SafeStorage.set(CONFIG_APP.STORAGE_THEME, null);
            await SafeStorage.set(CONFIG_APP.FIN_THEME, null);
            await SafeStorage.set(CONFIG_APP.STORAGE_PROPOSALS, null);
            await SafeStorage.set('force_relogin', true);
            location.reload();
        });
    },

    changeOperator() {
        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay) {
            loginOverlay.style.display = 'flex';
            const inputNome = document.getElementById('input-login-nome');
            const inputEquipe = document.getElementById('input-login-equipe');
            if (inputNome) inputNome.value = '';
            if (inputEquipe) inputEquipe.value = '';
            if (inputNome) inputNome.focus();
        }
    },

    async exportBackup() {
        const dados = {
            data: await SafeStorage.get(CONFIG_APP.STORAGE_DATA, null),
            macros: await SafeStorage.get(CONFIG_APP.STORAGE_MACROS, null),
            agenda: await SafeStorage.get(CONFIG_APP.STORAGE_AGENDA, null),
            proposals: await SafeStorage.get(CONFIG_APP.STORAGE_PROPOSALS, null)
        };
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-hyperflow-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importBackup() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const dados = JSON.parse(event.target.result);
                    if (dados.data) await SafeStorage.set(CONFIG_APP.STORAGE_DATA, dados.data);
                    if (dados.macros) await SafeStorage.set(CONFIG_APP.STORAGE_MACROS, dados.macros);
                    if (dados.agenda) await SafeStorage.set(CONFIG_APP.STORAGE_AGENDA, dados.agenda);
                    if (dados.proposals) await SafeStorage.set(CONFIG_APP.STORAGE_PROPOSALS, dados.proposals);
                    ToastService.success("Backup restaurado com sucesso!");
                    setTimeout(() => location.reload(), 2000);
                } catch (err) {
                    ToastService.error("Erro ao restaurar backup: " + err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },

    clearProposalHistory() {
        ModalService.confirm("Limpar histórico?", "Tem certeza que deseja apagar permanentemente o histórico de propostas?", async () => {
            await SafeStorage.set(CONFIG_APP.STORAGE_PROPOSALS, []);
            const listaEl = document.getElementById('lista-hist-propostas');
            if (listaEl) {
                listaEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--fin-label); font-size:11px;">Nenhuma proposta encontrada.</div>';
            }
            ToastService.success("Histórico limpo!");
        });
    }
};

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'tamperMenu' && TamperMenuActions[msg.cmd]) {
        TamperMenuActions[msg.cmd]();
    }
    if (msg.action === 'command') {
        if (msg.cmd === 'abrir-painel-financeiro') {
            const btn = document.getElementById('btn-sd-fin');
            if (btn) btn.click();
        }
        if (msg.cmd === 'abrir-bloco-notas') {
            const btn = document.getElementById('btn-sd-note');
            if (btn) btn.click();
        }
    }
});

/**
 * Injeta um arquivo CSS externo da extensão no documento.
 * Idempotente: ignora se o link já foi inserido.
 * @param {string} cssFile - Nome do arquivo em content/styles/
 */
function injectStyles(cssFile) {
    if (document.querySelector(`link[data-fd="${cssFile}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.fd = cssFile;
    link.href = chrome.runtime.getURL(`content/styles/${cssFile}`);
    (document.head || document.documentElement).appendChild(link);
}

let siteListenerConfigured = false;

/**
 * Escuta adições ou remoções de domínios no options em tempo real para reagir na aba atual.
 */
function setupStorageSiteListener() {
    if (siteListenerConfigured) return;
    siteListenerConfigured = true;

    chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area === 'local' && changes.SITE_PROFILES) {
            const updatedProfile = await globalThis.resolveSiteProfile();
            if (updatedProfile && !document.getElementById('abrir-painel')) {
                console.log('[FlowDesk] Site ativado em tempo real! Inicializando...');
                initApp();
            } else if (!updatedProfile && document.getElementById('abrir-painel')) {
                console.log('[FlowDesk] Site desativado. Removendo interface...');
                document.getElementById('abrir-painel')?.remove();
                document.getElementById('painel-financeiro')?.remove();
                document.getElementById('bloco-notas')?.remove();
                document.getElementById('login-overlay')?.remove();
            }
        }
    });
}

const initApp = async () => {
    // 1. Guarda de Frame: nunca injeta em iframes internos da intranet
    if (window !== window.top) {
        return;
    }

    // 2. Guarda de Conteúdo: nunca injeta em XML, PDF viewers ou imagens
    if (document.contentType && !document.contentType.includes('html')) {
        return;
    }

    setupStorageSiteListener();

    // 3. Resolução assíncrona do perfil de ativação do site
    const profile = await globalThis.resolveSiteProfile();
    if (!profile) {
        // Site não ativado nas configurações: sai silenciosamente sem injetar nada no DOM
        return;
    }

    injectStyles('tokens.css');

    // ─── TEMA E ESCALA GLOBAIS ───
    const prefs = await chrome.storage.local.get(['hyper_bloco_theme', 'fd_font_size', 'fd_panel_scale']);
    document.documentElement.setAttribute('data-fd-theme', prefs.hyper_bloco_theme ? 'dark' : 'light');
    
    if (prefs.fd_font_size) {
        document.documentElement.style.setProperty('--fd-font-size-base', prefs.fd_font_size);
    }
    if (prefs.fd_panel_scale) {
        document.documentElement.style.setProperty('--fd-panel-scale', prefs.fd_panel_scale);
    } else {
        document.documentElement.style.setProperty('--fd-panel-scale', '1.0');
    }

    document.addEventListener('flowdeskThemeChanged', (e) => {
        document.documentElement.setAttribute('data-fd-theme', e.detail.isDark ? 'dark' : 'light');
    });

    // Escuta mudanças feitas no popup/options para atualizar dinamicamente
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes.hyper_bloco_theme) {
                document.documentElement.setAttribute('data-fd-theme', changes.hyper_bloco_theme.newValue ? 'dark' : 'light');
            }
            if (changes.fd_font_size) {
                document.documentElement.style.setProperty('--fd-font-size-base', changes.fd_font_size.newValue);
            }
            if (changes.fd_panel_scale) {
                document.documentElement.style.setProperty('--fd-panel-scale', changes.fd_panel_scale.newValue);
            }
        }
    });
    // ───────────────────────────

    if (profile.enableFinModule !== false) await FinModule.init();
    SpeedDial.init();
    if (profile.enableNotesModule !== false) await NotesModule.init();
    window.addEventListener('resize', clampAllElementsToViewport);

    // =========================================================================
    // EVENTOS DE TECLADO MUNDIAIS (ATALHOS)
    // =========================================================================
    document.addEventListener('keydown', (e) => {
        // Atalho: Alt + 1 -> Abre o Painel Financeiro
        if (e.altKey && e.key === "1") {
            e.preventDefault();
            const p = document.getElementById('painel-financeiro');
            if (p) {
                p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
                if (p.style.display === 'flex') {
                    document.getElementById('fin-total')?.focus();
                    p.style.zIndex = "var(--fd-z-active, 2147483645)";
                    const n = document.getElementById('bloco-notas');
                    if (n) n.style.zIndex = "var(--fd-z-panel, 2147483642)";
                }
            }
        }
        // Atalho: Alt + ' -> Abre o Bloco de Notas / Overlay
        if (e.altKey && e.key === "'") {
            e.preventDefault();
            const b = document.getElementById('bloco-notas');
            if (b) {
                b.style.display = b.style.display === 'flex' ? 'none' : 'flex';
                if (b.style.display === 'flex') {
                    document.getElementById('area-texto')?.focus();
                    b.style.zIndex = "var(--fd-z-active, 2147483645)";
                    const p = document.getElementById('painel-financeiro');
                    if (p) p.style.zIndex = "var(--fd-z-panel, 2147483642)";
                }
            }
        }
    });

    // =========================================================================
    // RE-INJEÇÃO RESILIENTE PARA SPAs (React / Angular / Vue / Intranets)
    // Monitora desmontagem do DOM e navegações internas de histórico.
    // =========================================================================
    const checkAndRestoreDOM = debounce(async () => {
        const activeProf = await globalThis.resolveSiteProfile();
        if (!activeProf) return;

        let needsReinject = false;
        if (!document.getElementById('abrir-painel')) needsReinject = true;
        if (activeProf.enableFinModule !== false && !document.getElementById('painel-financeiro')) needsReinject = true;
        if (activeProf.enableNotesModule !== false && !document.getElementById('bloco-notas')) needsReinject = true;

        if (needsReinject) {
            console.log('[FlowDesk] SPA DOM reset detectado — reinjetando componentes...');
            initApp();
        }
    }, 600);

    const routeObserver = new MutationObserver(checkAndRestoreDOM);
    if (document.body) {
        routeObserver.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.body) routeObserver.observe(document.body, { childList: true, subtree: true });
        });
    }

    window.addEventListener('popstate', checkAndRestoreDOM);
    window.addEventListener('hashchange', checkAndRestoreDOM);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

}
