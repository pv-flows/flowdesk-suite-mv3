// FlowDesk MV3 — settings.js
// Sprint 4.1 — Lógica da página de configurações

document.addEventListener('DOMContentLoaded', async () => {
    
    // --- NAVEGAÇÃO DA SIDEBAR ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            item.classList.add('active');
            const target = item.getAttribute('data-target');
            document.getElementById(target).classList.add('active');
        });
    });

    // Função auxiliar para feedback visual nos botões
    function flashBtn(btn, originalText, msg, isError = false) {
        btn.textContent = msg;
        btn.style.backgroundColor = isError ? '#fff5f5' : '#f0fff4';
        btn.style.color = isError ? '#e53e3e' : '#38a169';
        btn.style.borderColor = isError ? '#feb2b2' : '#9ae6b4';
        btn.disabled = true;
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
            btn.style.color = '';
            btn.style.borderColor = '';
            btn.disabled = false;
        }, 2000);
    }

    // --- SEÇÃO: IDENTIDADE ---
    const inputNome = document.getElementById('opt-nome');
    const selectEquipe = document.getElementById('opt-equipe');
    const btnSaveIdentidade = document.getElementById('btn-save-identidade');

    // Carregar equipes da whitelist (se houver AuthModule e SafeStorage)
    if (globalThis.AuthModule) {
        const equipes = await globalThis.AuthModule.getEquipes();
        equipes.forEach(eq => {
            const option = document.createElement('option');
            option.value = eq;
            option.textContent = eq;
            selectEquipe.appendChild(option);
        });
    } else {
        ['Digital', 'Presencial', 'Receptivo'].forEach(eq => {
            const option = document.createElement('option');
            option.value = eq;
            option.textContent = eq;
            selectEquipe.appendChild(option);
        });
    }

    const { user_nome, user_equipe } = await chrome.storage.local.get(['user_nome', 'user_equipe']);
    if (user_nome) inputNome.value = user_nome;
    if (user_equipe) selectEquipe.value = user_equipe;

    // Auxiliar para despachar o clique para todas as abas abertas
    const broadcastCmd = (cmd) => {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                try { chrome.tabs.sendMessage(tab.id, { action: 'tamperMenu', cmd: cmd }).catch(()=>{}); } catch(e){}
            });
        });
    };

    const btnChangeOperator = document.getElementById('btn-change-operator');

    btnSaveIdentidade.addEventListener('click', async () => {
        const nome = inputNome.value.trim();
        const equipe = selectEquipe.value;
        if (!nome || !equipe) {
            flashBtn(btnSaveIdentidade, 'Salvar Identidade', '❌ Preencha todos os campos', true);
            return;
        }
        await chrome.storage.local.set({ user_nome: nome, user_equipe: equipe });
        flashBtn(btnSaveIdentidade, 'Salvar Identidade', 'Salvo ✓');
    });

    btnChangeOperator.addEventListener('click', async () => {
        await chrome.storage.local.remove(['user_nome', 'user_equipe']);
        inputNome.value = '';
        broadcastCmd('changeOperator');
        flashBtn(btnChangeOperator, 'Trocar Operador', 'Operador Deslogado ✓');
    });

    // --- SEÇÃO: SEGURANÇA ---
    const inputGroq = document.getElementById('opt-groq-key');
    const inputWebhook = document.getElementById('opt-webhook-url');
    const inputWhitelist = document.getElementById('opt-whitelist');
    const btnSaveGroq = document.getElementById('btn-save-groq');
    const btnSaveWebhook = document.getElementById('btn-save-webhook');
    const btnSaveWhitelist = document.getElementById('btn-save-whitelist');

    const securityData = await chrome.storage.local.get(['groq_api_key', 'webhook_url', 'operadores_whitelist']);
    if (securityData.groq_api_key) inputGroq.value = securityData.groq_api_key;
    if (securityData.webhook_url) inputWebhook.value = securityData.webhook_url;
    if (securityData.operadores_whitelist) {
        inputWhitelist.value = securityData.operadores_whitelist
            .map(op => `${op.nome},${op.equipe}`)
            .join('\n');
    }

    btnSaveGroq.addEventListener('click', async () => {
        const val = inputGroq.value.trim();
        if (val && !val.startsWith('gsk_')) {
            flashBtn(btnSaveGroq, 'Salvar Chave Groq', '❌ Deve começar com gsk_', true);
            return;
        }
        await chrome.storage.local.set({ groq_api_key: val });
        flashBtn(btnSaveGroq, 'Salvar Chave Groq', 'Salvo ✓');
    });

    btnSaveWebhook.addEventListener('click', async () => {
        const val = inputWebhook.value.trim();
        if (val && !val.startsWith('https://script.google.com')) {
            flashBtn(btnSaveWebhook, 'Salvar Webhook', '❌ URL inválida', true);
            return;
        }
        await chrome.storage.local.set({ webhook_url: val });
        flashBtn(btnSaveWebhook, 'Salvar Webhook', 'Salvo ✓');
    });

    btnSaveWhitelist.addEventListener('click', async () => {
        const lines = inputWhitelist.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const whitelist = [];
        for (const line of lines) {
            const parts = line.split(',');
            if (parts.length >= 2) {
                whitelist.push({ nome: parts[0].trim(), equipe: parts[1].trim() });
            }
        }
        await chrome.storage.local.set({ operadores_whitelist: whitelist });
        flashBtn(btnSaveWhitelist, 'Salvar Whitelist', 'Salvo ✓');
    });

    // --- SEÇÃO: APARÊNCIA ---
    const selectTheme = document.getElementById('opt-theme');
    const selectFontSize = document.getElementById('opt-font-size');
    const appearanceData = await chrome.storage.local.get(['hyper_bloco_theme', 'fd_font_size']);
    
    selectTheme.value = appearanceData.hyper_bloco_theme ? 'dark' : 'light';
    selectFontSize.value = appearanceData.fd_font_size || '13px';

    const saveAppearance = async () => {
        const isDark = selectTheme.value === 'dark';
        await chrome.storage.local.set({ 
            hyper_bloco_theme: isDark,
            fin_painel_theme: isDark,
            fd_font_size: selectFontSize.value 
        });
        // Feedback via toast não é necessário aqui
    };

    selectTheme.addEventListener('change', saveAppearance);
    selectFontSize.addEventListener('change', saveAppearance);

    // --- SEÇÃO: PERSONALIZAÇÃO ---
    const PANEL_SECTION_DEFAULTS = {
        matricula: true,
        pix: true,
        boleto_vista: true,
        boleto_parcelado: true,
        cartao: true,
        auto_referencia: true
    };

    const toggleIds = {
        matricula: 'toggle-matricula',
        pix: 'toggle-pix',
        boleto_vista: 'toggle-boleto-vista',
        boleto_parcelado: 'toggle-boleto-parcelado',
        cartao: 'toggle-cartao',
        auto_referencia: 'toggle-auto-referencia'
    };

    const panelSectionsData = await chrome.storage.local.get('fd_panel_sections');
    const panelSections = { ...PANEL_SECTION_DEFAULTS, ...(panelSectionsData.fd_panel_sections || {}) };

    // Preencher checkboxes com o estado salvo
    for (const [key, elId] of Object.entries(toggleIds)) {
        const el = document.getElementById(elId);
        if (el) el.checked = panelSections[key] !== false;
    }

    // Salvar automaticamente ao clicar em qualquer toggle
    const savePanelSections = async () => {
        const newSections = {};
        for (const [key, elId] of Object.entries(toggleIds)) {
            const el = document.getElementById(elId);
            newSections[key] = el ? el.checked : true;
        }
        await chrome.storage.local.set({ fd_panel_sections: newSections });
    };

    for (const elId of Object.values(toggleIds)) {
        const el = document.getElementById(elId);
        if (el) el.addEventListener('change', savePanelSections);
    }

    // --- SEÇÃO: SITES ATIVOS ---
    const chkWhatsapp = document.getElementById('site-whatsapp');
    const chkGmail = document.getElementById('site-gmail');
    const btnAddSite = document.getElementById('btn-add-site');
    const inputNewSite = document.getElementById('opt-new-site');
    const customSitesList = document.getElementById('custom-sites-list');

    let siteProfiles = {};
    const siteData = await chrome.storage.local.get('SITE_PROFILES');
    if (siteData.SITE_PROFILES) {
        siteProfiles = siteData.SITE_PROFILES;
    } else {
        // Defaults
        siteProfiles = {
            'conversas.hyperflow.global': { enableFinModule: true, enableNotesModule: true, enableMacroSuggester: true, enableTelemetry: true },
            'web.whatsapp.com': { enableFinModule: false, enableNotesModule: true, enableMacroSuggester: true, enableTelemetry: false },
            'mail.google.com': { enableFinModule: false, enableNotesModule: true, enableMacroSuggester: true, enableTelemetry: false }
        };
    }

    chkWhatsapp.checked = !!siteProfiles['web.whatsapp.com'];
    chkGmail.checked = !!siteProfiles['mail.google.com'];

    const renderCustomSites = () => {
        customSitesList.innerHTML = '';
        const defaultSites = ['conversas.hyperflow.global', 'web.whatsapp.com', 'mail.google.com', 'default'];
        
        Object.keys(siteProfiles).forEach(site => {
            if (!defaultSites.includes(site)) {
                const div = document.createElement('div');
                div.className = 'site-toggle';
                div.innerHTML = `
                    <span>${site}</span>
                    <button class="btn btn-danger" data-site="${site}" style="padding: 4px 8px; font-size: 11px;">Remover</button>
                `;
                div.querySelector('button').onclick = async () => {
                    delete siteProfiles[site];
                    await chrome.storage.local.set({ SITE_PROFILES: siteProfiles });
                    renderCustomSites();
                };
                customSitesList.appendChild(div);
            }
        });
    };

    renderCustomSites();

    const saveSiteToggle = async (site, isChecked) => {
        if (isChecked) {
            siteProfiles[site] = { enableFinModule: true, enableNotesModule: true, enableMacroSuggester: true, enableTelemetry: false };
        } else {
            delete siteProfiles[site];
        }
        await chrome.storage.local.set({ SITE_PROFILES: siteProfiles });
    };

    chkWhatsapp.addEventListener('change', (e) => saveSiteToggle('web.whatsapp.com', e.target.checked));
    chkGmail.addEventListener('change', (e) => saveSiteToggle('mail.google.com', e.target.checked));

    btnAddSite.addEventListener('click', async () => {
        let val = inputNewSite.value.trim();
        if (!val) return;
        val = val.replace(/^https?:\/\//, '').split('/')[0];
        
        siteProfiles[val] = { enableFinModule: false, enableNotesModule: true, enableMacroSuggester: true, enableTelemetry: false };
        await chrome.storage.local.set({ SITE_PROFILES: siteProfiles });
        inputNewSite.value = '';
        renderCustomSites();
    });

    // --- SEÇÃO: BACKUP ---
    const btnResetPos = document.getElementById('btn-reset-positions');
    const btnExport = document.getElementById('btn-export-backup');
    const btnImport = document.getElementById('btn-import-backup');
    const fileImport = document.getElementById('file-import');
    const btnClearHist = document.getElementById('btn-clear-history');
    const btnFactoryReset = document.getElementById('btn-factory-reset');

    btnResetPos.addEventListener('click', () => {
        broadcastCmd('resetPositions');
        flashBtn(btnResetPos, '🔄 Resetar Posições dos Painéis', 'Posições Resetadas ✓');
    });

    btnExport.addEventListener('click', async () => {
        const keysToExport = [
            'hyper_bloco_data_v2', 'hyper_bloco_macros_v2', 'hyper_bloco_agenda_v1',
            'flowdesk_proposals_v1', 'operadores_whitelist', 'SITE_PROFILES'
        ];
        const data = await chrome.storage.local.get(keysToExport);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flowdesk-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    btnImport.addEventListener('click', () => fileImport.click());

    fileImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                await chrome.storage.local.set(data);
                alert("Backup importado com sucesso! As alterações já estão ativas.");
            } catch (err) {
                alert("Erro ao ler o arquivo: " + err.message);
            }
        };
        reader.readAsText(file);
    });

    btnClearHist.addEventListener('click', async () => {
        if (confirm("Tem certeza que deseja apagar todo o histórico de propostas?")) {
            await chrome.storage.local.set({ flowdesk_proposals_v1: [] });
            flashBtn(btnClearHist, '🗑️ Limpar Histórico de Propostas', 'Histórico Limpo ✓');
        }
    });

    btnFactoryReset.addEventListener('click', async () => {
        if (confirm("ATENÇÃO! Isso apagará todas as configurações, anotações e histórico. Tem certeza?")) {
            await chrome.storage.local.clear();
            alert("Extensão resetada. Feche esta página.");
            window.close();
        }
    });

    // --- SEÇÃO: SOBRE ---
    const manifest = chrome.runtime.getManifest();
    document.getElementById('opt-version').textContent = manifest.version;

});
