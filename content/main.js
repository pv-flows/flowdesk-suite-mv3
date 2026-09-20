// FlowDesk MV3 — main.js
// Sprint 3.4 — MutationObserver SPA re-injection

/**
 * Lógica baseada no TamperMenu, agora orquestrada via background messages 
 * disparadas pelos cliques no Popup da extensão.
 */
if (!globalThis._flowdeskMainInitialized) {
globalThis._flowdeskMainInitialized = true;

const TamperMenuActions = {
    resetPositions() {
        const painelFin = document.getElementById('painel-financeiro');
        if (painelFin) {
            painelFin.style.top = '10px';
            painelFin.style.right = '10px';
            painelFin.style.left = 'auto';
            painelFin.style.bottom = 'auto';
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
            painelNote.style.top = '10px';
            painelNote.style.left = '10px';
            painelNote.style.width = '350px';
            painelNote.style.height = '375px';
        }

        ToastService.success("✅ Janelas realinhadas para o padrão!");
    },

    resetToDefaults() {
        ModalService.confirm("Resetar tudo?", "Tem certeza que deseja resetar todas as configurações e cookies para o padrão? Esta ação é irreversível.", async () => {
            await SafeStorage.set(CONFIG_APP.STORAGE_DATA, null);
            await SafeStorage.set(CONFIG_APP.STORAGE_POS, null);
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

const initApp = async () => {
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

    const profile = globalThis.getCurrentProfile();
    if (profile.enableFinModule) await FinModule.init();
    SpeedDial.init();
    if (profile.enableNotesModule) await NotesModule.init();
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
                    p.style.zIndex = "10000";
                    const n = document.getElementById('bloco-notas');
                    if (n) n.style.zIndex = "9999";
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
                    b.style.zIndex = "10000";
                    const p = document.getElementById('painel-financeiro');
                    if (p) p.style.zIndex = "9999";
                }
            }
        }
    });

    // =========================================================================
    // RE-INJEÇÃO RESILIENTE PARA SPAs
    // Hyperflow React desmonta o DOM em navegações internas.
    // O observer detecta a remoção do FAB e re-executa initApp().
    // =========================================================================
    const routeObserver = new MutationObserver(debounce(() => {
        if (!document.getElementById('abrir-painel')) {
            console.log('[FlowDesk] DOM reset detectado — reinjetando...');
            initApp();
        }
    }, 800));
    if (document.body) {
        routeObserver.observe(document.body, { childList: true, subtree: false });
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

}
