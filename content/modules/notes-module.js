// FlowDesk MV3 — notes-module.js
// Sprint 5.3 — Refatoração de CSS (Design Tokens)

globalThis.NotesModule = (function () {

        // --- MACROS DINÂMICAS (geradas em tempo de execução) ---

        /** Macros cujo valor é calculado dinamicamente (não estático) */
        const DYNAMIC_MACROS = {
            ';xau': () => {
                const h = new Date().getHours();
                let p = h < 12 ? 'dia' : h < 18 ? 'tarde' : 'noite';
                let art = h < 12 ? 'um' : 'uma';
                let adj = h < 12 ? 'ótimo' : 'ótima';
                return `Qualquer dúvida estou por aqui. Obrigado e tenha ${art} ${adj} ${p}! 😊`;
            },
            ';hoje': () => new Date().toLocaleDateString('pt-BR'),
            ';agora': () => new Date().toLocaleTimeString('pt-BR').substring(0, 5),
            ';oi': async () => {
                const ident = await GlobalState.getIdentity();
                const primeiroNome = ident.nome && ident.nome !== 'Operador' ? ident.nome.trim().split(' ')[0] : 'Analista';
                return `Olá, me chamo ${primeiroNome} e vou dar continuidade ao seu atendimento.`;
            }
        };

        // --- FUNÇÕES UTILITÁRIAS ---

        /**
         * Escapa caracteres HTML para prevenir XSS.
         * @param {string} str
         * @returns {string}
         */
        const escapeHTML = (str) => {
            if (!str) return '';
            return str.replace(/[&<>'"]/g, tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag]));
        };

        // --- MACROS PADRÃO ---

        /** Lista de macros iniciais pré-configuradas */
        const defaultMacros = [
            { key: ";oi", val: "MACRO DINAMICA DE APRESENTACAO" },
            { key: ";pix", val: "Acordo formalizado com sucesso! ✅\nSegue o link para pagamento via PIX (compensação imediata):\n\n" },
            { key: ";bol", val: "Acordo formalizado com sucesso! ✅\nSegue o boleto para pagamento:" },
            { key: ";car", val: "Acordo formalizado com sucesso! ✅\nLink seguro para cartão de crédito:\n\n" },
            { key: ";cob", val: "Olá! {{nome}} da equipe {{equipe}} por aqui. Passo para verificar se deu certo o pagamento do seu acordo ou se houve algum imprevisto. Me avise se precisar que eu reenvie o boleto." },
            { key: ";xau", val: "MACRO DINAMICA DE DESPEDIDA" }
        ];

        // --- ESTADO DO MÓDULO ---
        let appData = {
            activeTabId: 1,
            tabs: [{ id: 1, title: 'Guia 1', content: '', history: [] }]
        };
        let macrosList = [];
        let agendaData = { items: [] };
        let isDarkMode = false;

        // -----------------------------------------------------------------
        // EVENTOS E ATUALIZAÇÕES
        // -----------------------------------------------------------------

        /**
         * Aplica valor ao input de forma compatível com frameworks reativos (React, Vue).
         * Usa o setter nativo para disparar eventos corretamente.
         * @param {HTMLElement} element - Input ou textarea alvo
         * @param {string} newValue - Novo valor a ser inserido
         */
        function applyMacroToInput(element, newValue) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, "value"
            ).set;
            const nativeTextAreaSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, "value"
            ).set;
            const prototypeSetter = (element.tagName === 'INPUT')
                ? nativeInputValueSetter
                : nativeTextAreaSetter;

            if (prototypeSetter) {
                prototypeSetter.call(element, newValue);
            } else {
                element.value = newValue;
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // --- MACRO SUGGESTER VISUAL ---
        const MacroSuggester = {
            panel: null,
            listEl: null,
            previewEl: null,
            isSuggesting: false,
            filteredMacros: [],
            currentIndex: 0,
            activeElement: null,
            triggerStartIndex: -1,

            init() {
                if (document.getElementById('macro-suggestion-panel')) return;

                this.panel = document.createElement('div');
                this.panel.id = 'macro-suggestion-panel';
                if (isDarkMode) this.panel.classList.add('dark-mode');

                this.listEl = document.createElement('div');
                this.listEl.id = 'macro-suggestion-list';

                this.previewEl = document.createElement('div');
                this.previewEl.id = 'macro-suggestion-preview';

                this.panel.appendChild(this.listEl);
                this.panel.appendChild(this.previewEl);
                this.panel.setAttribute('data-darkreader-ignore', '');
                this.panel.setAttribute('data-darkreader-mode', '0');
                this.panel.style.colorScheme = isDarkMode ? 'dark' : 'light';
                document.body.appendChild(this.panel);

                this.setupListeners();
            },

            setupListeners() {
                document.addEventListener('keydown', (e) => this.handleKeyDown(e), true);
                document.addEventListener('input', (e) => this.handleInput(e), true);
                document.addEventListener('click', (e) => this.handleClickOutside(e));
            },

            open(element, startIndex) {
                this.isSuggesting = true;
                this.activeElement = element;
                this.triggerStartIndex = startIndex;
                this.updateFilter(';');

                // Não exibe a interface visual se estiver dentro dos painéis do FlowDesk
                // Permite apenas o auto-preenchimento
                const isInsideFlowDesk = element.closest('#bloco-notas') ||
                    element.closest('#painel-financeiro') ||
                    element.closest('#bt-speed-dial-container');

                if (!isInsideFlowDesk) {
                    this.panel.style.display = 'flex';
                    this.positionPanel();
                }
            },

            close() {
                this.isSuggesting = false;
                this.activeElement = null;
                this.triggerStartIndex = -1;
                this.filteredMacros = [];
                if (this.panel) this.panel.style.display = 'none';
            },

            positionPanel() {
                if (!this.activeElement) return;
                const rect = this.activeElement.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const left = Math.min(rect.left, window.innerWidth - 510);

                if (spaceBelow >= 60) {
                    this.panel.style.top = (rect.bottom + 5) + 'px';
                    this.panel.style.bottom = 'auto';
                } else {
                    this.panel.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
                    this.panel.style.top = 'auto';
                }
                this.panel.style.left = Math.max(0, left) + 'px';
            },

            async getExpandedText(macro) {
                let expandedText = macro.val;
                if (DYNAMIC_MACROS[macro.key]) {
                    expandedText = await DYNAMIC_MACROS[macro.key]();
                }
                const ident = await GlobalState.getIdentity();
                expandedText = expandedText
                    .replace(/{{nome}}/g, ident.nome)
                    .replace(/{{equipe}}/g, ident.equipe);
                return expandedText;
            },

            updateFilter(typedText) {
                const query = typedText.toLowerCase();
                this.filteredMacros = macrosList.filter(m => m.key.toLowerCase().startsWith(query));

                if (this.filteredMacros.length === 0) {
                    if (this.panel) this.panel.style.display = 'none';
                    if (this.listEl) this.listEl.innerHTML = '';
                    if (this.previewEl) this.previewEl.innerText = '';
                    return;
                }

                this.currentIndex = 0;
                this.render();
            },

            render() {
                if (this.panel && this.panel.style.display === 'none' && this.isSuggesting) {
                    const isInsideFlowDesk = this.activeElement?.closest('#bloco-notas') ||
                        this.activeElement?.closest('#painel-financeiro') ||
                        this.activeElement?.closest('#bt-speed-dial-container');
                    if (!isInsideFlowDesk) this.panel.style.display = 'flex';
                }
                this.listEl.innerHTML = '';
                this.filteredMacros.forEach((macro, idx) => {
                    const item = document.createElement('div');
                    item.className = 'macro-suggestion-item' + (idx === this.currentIndex ? ' selected' : '');
                    item.innerText = macro.key;
                    item.onmousedown = (e) => {
                        e.preventDefault();
                        this.currentIndex = idx;
                        this.applySelected();
                    };
                    item.onmouseenter = () => {
                        this.currentIndex = idx;
                        this.renderPreview();
                        Array.from(this.listEl.children).forEach((child, i) => {
                            child.classList.toggle('selected', i === this.currentIndex);
                        });
                    };
                    this.listEl.appendChild(item);
                });
                this.renderPreview();
                this.scrollToSelection();

            },

            async renderPreview() {
                const macro = this.filteredMacros[this.currentIndex];
                if (!macro) {
                    this.previewEl.innerText = '';
                    return;
                }
                this.previewEl.innerText = await this.getExpandedText(macro);
            },

            scrollToSelection() {
                const selectedEl = this.listEl.children[this.currentIndex];
                if (selectedEl) {
                    selectedEl.scrollIntoView({ block: 'nearest' });
                }
            },

            async applySelected() {
                if (!this.activeElement || !this.filteredMacros[this.currentIndex]) return;

                const macro = this.filteredMacros[this.currentIndex];
                const expandedText = await this.getExpandedText(macro);

                const text = this.activeElement.value;
                const textBeforeMacro = text.substring(0, this.triggerStartIndex);
                const textAfterCursor = text.substring(this.activeElement.selectionStart);
                const newText = textBeforeMacro + expandedText + textAfterCursor;

                applyMacroToInput(this.activeElement, newText);

                const newCursorPos = textBeforeMacro.length + expandedText.length;
                try {
                    if (typeof this.activeElement.setSelectionRange === 'function') {
                        this.activeElement.setSelectionRange(newCursorPos, newCursorPos);
                    }
                } catch (err) {
                    console.warn('[MacroSuggester] setSelectionRange not supported on this input type.');
                }

                const macroMap = {
                    ';pix': 'PIX', ';bol': 'Boleto', ';car': 'Cartão de Crédito',
                    ';oferta': 'Oferta Genérica', ';negociar': 'Negociação', ';cob': 'Cobrança'
                };
                if (macroMap[macro.key]) {
                    GlobalState.sendPing("Macro", macroMap[macro.key], 0);
                }

                if (this.activeElement.id === CONFIG_APP.DOM_ID.TEXT_AREA) {
                    const currentTab = appData.tabs.find(t => t.id === appData.activeTabId);
                    if (currentTab) {
                        currentTab.content = newText;
                        salvarDados();
                    }
                }

                this.close();
            },

            handleKeyDown(e) {
                const el = e.target;
                if (!el || !['TEXTAREA', 'INPUT'].includes(el.tagName)) return;

                if (e.key === ';') {
                    const val = el.value;
                    const pos = el.selectionStart;
                    if (pos === 0 || /[\s,.:!?]/.test(val.charAt(pos - 1))) {
                        setTimeout(() => this.open(el, pos), 0);
                        return;
                    }
                }

                if (!this.isSuggesting) return;

                if (e.key === 'Escape') {
                    this.close();
                    return;
                }

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.currentIndex = (this.currentIndex + 1) % this.filteredMacros.length;
                    this.render();
                    return;
                }

                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.currentIndex = (this.currentIndex - 1 + this.filteredMacros.length) % this.filteredMacros.length;
                    this.render();
                    return;
                }

                if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    this.applySelected();
                    return;
                }
            },

            handleInput(e) {
                if (!this.isSuggesting) return;
                const el = this.activeElement;
                if (!el) return;

                const pos = el.selectionStart;
                if (pos < this.triggerStartIndex) {
                    this.close();
                    return;
                }

                const typedText = el.value.substring(this.triggerStartIndex, pos);
                if (typedText.includes(' ') || typedText.includes('\\n')) {
                    this.close();
                    return;
                }

                this.updateFilter(typedText);

                // Auto-preenchimento imediato por match exato
                if (this.filteredMacros.length === 1 && this.filteredMacros[0].key.toLowerCase() === typedText.toLowerCase()) {
                    this.applySelected();
                }
            },

            handleClickOutside(e) {
                if (this.isSuggesting && this.panel && !this.panel.contains(e.target) && e.target !== this.activeElement) {
                    this.close();
                }
            }
        };

        // -----------------------------------------------------------------
        // GERENCIAMENTO DE ABAS E PERSISTÊNCIA
        // -----------------------------------------------------------------

        /** Reordena títulos genéricos das abas sequencialmente */
        async function reordenarAbas() {
            appData.tabs.forEach((tab, index) => {
                if (/^(Guia( \\d+| TEMP)?|Nova \\d+|Geral)$/.test(tab.title)) {
                    tab.title = `Guia ${index + 1}`;
                }
            });
            await SafeStorage.set(CONFIG_APP.STORAGE_DATA, appData);
        }

        /** Carrega todos os dados persistidos do armazenamento */
        async function carregarDados() {
            appData = await SafeStorage.get(CONFIG_APP.STORAGE_DATA, {
                activeTabId: 1,
                tabs: [{ id: 1, title: 'Guia 1', content: '', history: [] }]
            });
            reordenarAbas();

            macrosList = await SafeStorage.get(CONFIG_APP.STORAGE_MACROS, defaultMacros);
            if (!macrosList.find(m => m.key === ';xau')) {
                macrosList.push({ key: ";xau", val: "MACRO DINAMICA DE DESPEDIDA" });
                await SafeStorage.set(CONFIG_APP.STORAGE_MACROS, macrosList);
            }
            if (!macrosList.find(m => m.key === ';oi')) {
                macrosList.push({ key: ";oi", val: "MACRO DINAMICA DE APRESENTACAO" });
                await SafeStorage.set(CONFIG_APP.STORAGE_MACROS, macrosList);
            }

            const agendaRaw = await SafeStorage.get(CONFIG_APP.STORAGE_AGENDA, { items: [] });
            if (agendaRaw.items) {
                agendaData = agendaRaw;
            } else if (agendaRaw.active || agendaRaw.history) {
                // Migração de formato legado
                const active = agendaRaw.active || [];
                const hist = agendaRaw.history || [];
                hist.forEach(i => i.done = true);
                agendaData.items = [...active, ...hist];
            } else {
                agendaData = { items: [] };
            }
        }

        // debounce global utilizado no lugar da definição local anterior

        const salvarDados = debounce(async () => await SafeStorage.set(CONFIG_APP.STORAGE_DATA, appData), 500);
        const salvarMacros = async () => await SafeStorage.set(CONFIG_APP.STORAGE_MACROS, macrosList);
        const salvarAgenda = async () => await SafeStorage.set(CONFIG_APP.STORAGE_AGENDA, agendaData);

        // -----------------------------------------------------------------
        // SISTEMA DE LEMBRETES (AGENDA)
        // -----------------------------------------------------------------

        /**
         * Verifica se um lembrete está vencido (data/hora passada).
         * @param {Object} item - Item da agenda
         * @returns {boolean}
         */
        function isDue(item) {
            if (item.done || !item.date || !item.time) return false;
            const now = new Date();
            const target = new Date(`${item.date}T${item.time}`);
            return now >= target;
        }

        /** Verifica lembretes e atualiza indicadores visuais (pulsing, badge) */
        function checkReminders() {
            let globalHasDue = false;

            agendaData.items.forEach(item => {
                const itemDue = isDue(item);
                if (itemDue) globalHasDue = true;

                const itemEl = document.querySelector(`.agenda-item[data-id="${item.id}"]`);
                if (itemEl) {
                    if (itemDue) itemEl.classList.add('due');
                    else itemEl.classList.remove('due');
                }
            });

            // Atualizar badge do botão Agenda
            const btnAgenda = document.getElementById('btn-agenda');
            if (btnAgenda) {
                if (globalHasDue) btnAgenda.classList.add('btn-alert');
                else btnAgenda.classList.remove('btn-alert');
            }

            // Atualizar pulsing do botão Speed Dial (quando painel fechado)
            const btnOpen = document.getElementById(CONFIG_APP.DOM_ID.BTN_OPEN);
            const container = document.getElementById(CONFIG_APP.DOM_ID.CONTAINER);
            if (btnOpen && container) {
                const isClosed = container.style.display === 'none' || container.style.display === '';
                if (globalHasDue && isClosed) {
                    btnOpen.classList.add('pulsing');
                } else {
                    btnOpen.classList.remove('pulsing');
                }
            }

            // Espelhar alerta de lembrete no botão principal do Speed Dial (pulso branco)
            const btnMain = document.getElementById('abrir-painel');
            if (btnMain) {
                // Para de pulsar se o menu estiver aberto (sd-open)
                const isDialOpen = btnMain.classList.contains('sd-open');
                if (globalHasDue && !isDialOpen) btnMain.classList.add('sd-alert');
                else btnMain.classList.remove('sd-alert');
            }
        }


        // -----------------------------------------------------------------
        // CSS DO MÓDULO (extraído de injetarBloco)
        // -----------------------------------------------------------------

        /**
         * Retorna os estilos CSS do NotesModule.
         * @returns {string}
         */
        function getNotesModuleStyles() {
            return `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* --- Variáveis Específicas do Módulo --- */
                :root {
                    --bn-accent: #dd6b20;
                    --bn-header-grad: linear-gradient(90deg, #dd6b20, #e05d23);
                }

                #bloco-notas.dark-mode, #macro-suggestion-panel.dark-mode {
                    --bn-accent: #f6ad55;
                }

                /* --- Reset & Container --- */
                #bloco-notas * { box-sizing: border-box; font-family: var(--fd-font-family); }

                #bloco-notas *::placeholder {
                    color: var(--fd-text-muted);
                    opacity: 1;
                }

                #bloco-notas {
                    position: fixed;
                    z-index: 9999;
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                    background: var(--fd-bg);
                    opacity: 0.98;
                    border-radius: 12px;
                    box-shadow: var(--fd-shadow-lg);
                    border: 1px solid var(--fd-border);
                    color: var(--fd-text);
                    resize: both;
                    min-width: 280px;
                    min-height: 300px;
                    transition: transform 0.2s, background-color 0.3s ease, color 0.3s ease,
                                border-color 0.3s ease, box-shadow 0.3s ease;
                    max-width: 95vw;
                    max-height: 95vh;
                    animation: fadeIn 0.2s ease-out;
                    zoom: var(--fd-panel-scale, 1.0);
                    color-scheme: light;
                    isolation: isolate;
                }
                #bloco-notas.em-movimento {
                    transition: none !important;
                    cursor: grabbing !important;
                    opacity: 0.8;
                }

                /* --- Cabeçalho --- */
                #cabecalho-bloco {
                    background: var(--bn-header-grad);
                    color: white;
                    padding: 8px 12px;
                    cursor: move;
                    font-weight: 600;
                    font-size: var(--fd-font-size-base);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    user-select: none;
                    flex-shrink: 0;
                }

                /* --- Abas --- */
                #tabs-container {
                    display: flex;
                    background: rgba(0,0,0,0.05);
                    padding: 4px 4px 0 4px;
                    overflow-x: auto;
                    overflow-y: hidden;
                    border-bottom: 1px solid var(--fd-border);
                    align-items: flex-end;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    flex-shrink: 0;
                }
                #tabs-container::-webkit-scrollbar { display: none; }
                .tab-item {
                    padding: 6px 8px 6px 12px;
                    font-size: var(--fd-font-size-sm);
                    font-weight: 600;
                    color: var(--fd-text-muted);
                    background: var(--fd-bg-secondary);
                    margin-right: 2px;
                    border-radius: 6px 6px 0 0;
                    cursor: pointer;
                    user-select: none;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    max-width: 110px;
                    flex-shrink: 0;
                    transition: background-color 0.3s ease, color 0.3s ease;
                }
                .tab-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .tab-item.active {
                    background: var(--fd-bg);
                    color: var(--bn-accent);
                    border-bottom: 2px solid var(--fd-bg);
                    margin-bottom: -1px;
                    z-index: 2;
                }
                .tab-close:hover { color: var(--fd-danger); background: rgba(229, 62, 62, 0.1); border-radius: 50%; }
                .tab-add {
                    padding: 4px 10px;
                    font-weight: bold;
                    cursor: pointer;
                    color: var(--fd-text-muted);
                    transition: color 0.3s ease;
                }
                .tab-add:hover { color: var(--bn-accent); }

                /* --- Corpo & Toolbar --- */
                #corpo-bloco { display: flex; flex-direction: column; flex: 1; min-height: 0; position: relative; }
                #toolbar-bloco {
                    padding: 6px 12px;
                    display: flex;
                    justify-content: space-between;
                    border-bottom: 1px solid var(--fd-border);
                    background: var(--fd-bg);
                    transition: background-color 0.3s ease, border-color 0.3s ease;
                }
                .btn-mini {
                    background: var(--fd-bg);
                    border: 1px solid var(--fd-border);
                    padding: 3px 10px;
                    font-size: var(--fd-font-size-xs);
                    cursor: pointer;
                    border-radius: 12px;
                    color: var(--fd-text-muted);
                    font-weight: 600;
                    transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
                }
                .btn-mini:hover { border-color: var(--bn-accent); color: var(--bn-accent); }

                /* --- Alertas e Pulsing --- */
                @keyframes pulse-alert {
                    0% { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(229, 62, 62, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0); }
                }
                .pulsing { animation: pulse-alert 2s infinite; background-color: var(--fd-danger) !important; }
                .btn-alert { background-color: var(--fd-danger) !important; color: white !important; border-color: #c53030 !important; }

                /* --- Área de Texto --- */
                #area-texto {
                    width: 100%;
                    height: 45%;
                    border: none;
                    padding: 12px;
                    resize: none;
                    outline: none;
                    background: var(--fd-bg-secondary);
                    font-size: var(--fd-font-size-base);
                    color: var(--fd-text);
                    transition: background-color 0.3s ease, color 0.3s ease;
                }

                /* --- Histórico --- */
                #historico-container {
                    flex: 1;
                    overflow-y: auto;
                    background: var(--fd-bg-secondary);
                    border-top: 1px solid var(--fd-border);
                    transition: background-color 0.3s ease, border-color 0.3s ease;
                }
                #titulo-hist {
                    font-size: var(--fd-font-size-micro);
                    font-weight: 700;
                    color: var(--fd-text-muted);
                    text-transform: uppercase;
                    padding: 6px 12px;
                    display: flex;
                    justify-content: space-between;
                    background: rgba(0,0,0,0.02);
                    transition: color 0.3s ease;
                }
                .hist-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    border-bottom: 1px solid var(--fd-border);
                    font-size: var(--fd-font-size-md);
                    cursor: pointer;
                    transition: border-color 0.3s ease;
                }
                .hist-item:hover { background: var(--fd-bg); }
                .hist-title-container { flex: 1; overflow: hidden; margin-right: 8px; }
                .hist-title {
                    font-weight: 600;
                    color: #2b6cb0;
                    display: block;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .hist-preview { font-size: var(--fd-font-size-xs); color: var(--fd-text-muted); transition: color 0.3s ease; }
                .hist-actions { display: flex; gap: 6px; opacity: 0.6; }
                .hist-item:hover .hist-actions { opacity: 1; }
                .btn-icon:hover { transform: scale(1.1); }

                /* --- Telas de Macros e Agenda (Overlays internos) --- */
                #screen-macros, #screen-agenda, #modal-confirm {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    z-index: 50;
                    display: none;
                    flex-direction: column;
                }
                #screen-macros, #screen-agenda {
                    background: var(--fd-bg-secondary);
                    transition: background-color 0.3s ease;
                }
                #modal-confirm {
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(4px);
                    align-items: center;
                    justify-content: center;
                }

                /* --- Cabeçalho de Macros --- */
                #header-macros {
                    padding: 10px;
                    border-bottom: 1px solid var(--fd-border);
                    display: flex;
                    justify-content: space-between;
                    background: var(--fd-bg);
                    transition: background-color 0.3s ease, border-color 0.3s ease;
                }
                .btn-close-macros { cursor: pointer; font-weight: bold; font-size: var(--fd-font-size-lg); }

                /* --- Containers Roláveis --- */
                #list-macros, #list-agenda, #historico-container { flex: 1; overflow-y: auto; padding: 10px; }

                /* --- Items de Macro e Agenda --- */
                .macro-item, .agenda-item {
                    background: var(--fd-bg);
                    border: 1px solid var(--fd-border);
                    border-radius: 6px;
                    padding: 8px;
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: background-color 0.3s ease, border-color 0.3s ease;
                }
                .macro-key { font-weight: bold; color: #3182ce; font-size: var(--fd-font-size-sm); }
                .macro-val { font-size: var(--fd-font-size-xs); color: var(--fd-text-muted); transition: color 0.3s ease; }
                .macro-actions-group { display: flex; align-items: center; gap: 4px; }
                .macro-btn {
                    cursor: pointer;
                    padding: 4px;
                    font-size: var(--fd-font-size-md);
                    color: var(--fd-text-muted);
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.3s ease;
                }
                .macro-btn:hover { background: var(--fd-bg-secondary); color: var(--fd-text); }
                .macro-btn.del:hover { background: rgba(229, 62, 62, 0.1); color: var(--fd-danger); }

                /* --- Agenda Items --- */
                .agenda-info { flex: 1; margin-left: 8px; }
                .agenda-text {
                    font-size: var(--fd-font-size-md);
                    font-weight: 600;
                    color: var(--fd-text);
                    transition: color 0.3s ease;
                }
                .agenda-text.riscado { text-decoration: line-through; opacity: 0.6; }
                .agenda-meta {
                    font-size: var(--fd-font-size-micro);
                    color: var(--fd-text-muted);
                    margin-top: 2px;
                    display: flex;
                    gap: 5px;
                    transition: color 0.3s ease;
                }
                .agenda-tag { background: rgba(0,0,0,0.05); padding: 1px 4px; border-radius: 3px; }
                .agenda-checkbox { cursor: pointer; transform: scale(1.2); }
                .agenda-separator { border-top: 1px solid var(--fd-border); margin: 8px 0; opacity: 0.5; transition: border-color 0.3s ease; }
                .agenda-item.completed { opacity: 0.6; }
                .agenda-item.due { border: 1px solid var(--fd-danger); background: rgba(229, 62, 62, 0.05); }
                .agenda-item.due .agenda-text { color: var(--fd-danger); font-weight: 700; }

                /* --- Formulário de Macros --- */
                #add-macro-form {
                    padding: 10px;
                    background: var(--fd-bg);
                    border-top: 1px solid var(--fd-border);
                    display: flex;
                    gap: 5px;
                    flex-direction: column;
                    transition: background-color 0.3s ease, border-color 0.3s ease;
                }
                .input-macro, .modal-input {
                    border: 1px solid var(--fd-border);
                    border-radius: 4px;
                    padding: 5px;
                    font-size: var(--fd-font-size-sm);
                    width: 100%;
                    background: var(--fd-bg);
                    color: var(--fd-text);
                    transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
                }
                .btn-add-macro {
                    background: #3182ce;
                    color: white;
                    border: none;
                    padding: 6px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: var(--fd-font-size-sm);
                }

                /* --- Modal de Confirmação --- */
                .modal-content {
                    background: var(--fd-bg);
                    padding: 20px;
                    border-radius: 12px;
                    width: 85%;
                    text-align: center;
                    border: 1px solid var(--fd-border);
                    transition: background-color 0.3s ease, border-color 0.3s ease;
                }
                .modal-title { font-weight: bold; margin-bottom: 10px; }
                .modal-btns { display: flex; gap: 10px; justify-content: center; margin-top: 15px; }
                .modal-btn {
                    padding: 6px 14px;
                    border-radius: 6px;
                    font-size: var(--fd-font-size-sm);
                    font-weight: 700;
                    cursor: pointer;
                    border: none;
                }
                .btn-danger { background: var(--fd-danger); color: white; }
                .btn-action { background: var(--bn-accent); color: white; }
                .btn-cancel {
                    background: var(--fd-bg-secondary);
                    border: 1px solid var(--fd-border);
                    color: var(--fd-text-muted);
                }

                /* --- Transição Global para Tema --- */
                .btn-mini, .tab-item, .macro-item, .agenda-item,
                .input-macro, .modal-input, #area-texto, .modal-content,
                #header-macros, .agenda-tag {
                    transition: background-color 0.3s ease, color 0.3s ease,
                                border-color 0.3s ease, box-shadow 0.3s ease;
                }

                /* --- Macro Suggestion Panel --- */
                #macro-suggestion-panel {
                    position: fixed;
                    z-index: 100000;
                    display: none;
                    flex-direction: row;
                    background: var(--fd-bg);
                    opacity: 0.98;
                    backdrop-filter: blur(10px);
                    border: 1px solid var(--fd-border);
                    border-radius: 8px;
                    box-shadow: var(--fd-shadow-lg);
                    width: 500px;
                    max-height: 250px;
                    overflow: hidden;
                    font-family: var(--fd-font-family);
                    color-scheme: light;
                    isolation: isolate;
                    transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
                }

                #macro-suggestion-list {
                    width: 40%;
                    border-right: 1px solid var(--fd-border);
                    overflow-y: auto;
                    background: transparent;
                }
                .macro-suggestion-item {
                    padding: 8px 12px;
                    cursor: pointer;
                    font-size: var(--fd-font-size-base);
                    color: var(--fd-text);
                    border-bottom: 1px solid var(--fd-border);
                    font-weight: 600;
                }
                .macro-suggestion-item.selected {
                    background: var(--bn-accent);
                    color: white;
                }
                .macro-suggestion-item:hover:not(.selected) {
                    background: var(--fd-bg-secondary);
                }
                #macro-suggestion-preview {
                    width: 60%;
                    padding: 12px;
                    font-size: var(--fd-font-size-base);
                    color: var(--fd-text-muted);
                    background: var(--fd-bg-secondary);
                    overflow-y: auto;
                    line-height: 1.4;
                    white-space: pre-wrap;
                }

                /* Configuração global para as scrollbars do Bloco de Notas e Suggester */
                #bloco-notas *::-webkit-scrollbar,
                #macro-suggestion-panel *::-webkit-scrollbar {
                    width: 6px;
                    background: transparent;
                }
                #bloco-notas *::-webkit-scrollbar-thumb,
                #macro-suggestion-panel *::-webkit-scrollbar-thumb {
                    background: rgba(160, 174, 192, 0.5);
                    border-radius: 10px;
                }
                #bloco-notas.dark-mode *::-webkit-scrollbar-thumb,
                #macro-suggestion-panel.dark-mode *::-webkit-scrollbar-thumb {
                    background: rgba(100, 116, 139, 0.6);
                }
            `;
        }


        // -----------------------------------------------------------------
        // FUNÇÃO PRINCIPAL: INJEÇÃO DO BLOCO DE NOTAS
        // -----------------------------------------------------------------

        /**
         * Injeta todos os elementos do NotesModule no DOM.
         * Cria estilos, HTML do bloco, e configura todos os event handlers.
         */
        async function injetarBloco() {
            if (document.getElementById(CONFIG_APP.DOM_ID.CONTAINER)) return;

            // --- Injetar CSS ---
            const styleId = 'estilo-bloco-notas-v6-2-perf';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = getNotesModuleStyles();
                document.head.appendChild(style);
            }

            // --- Criar Container ---
            const container = document.createElement('div');
            container.id = CONFIG_APP.DOM_ID.CONTAINER;
            if (isDarkMode) container.classList.add('dark-mode');
            container.style.top = '10px';
            container.style.left = '10px';
            container.style.width = '350px';
            container.style.height = '375px';

            // Restaurar posição salva
            const savedPos = await SafeStorage.get(CONFIG_APP.STORAGE_POS, null);
            if (savedPos) {
                if (savedPos.top) container.style.top = savedPos.top;
                if (savedPos.left) container.style.left = savedPos.left;
                if (savedPos.right) container.style.right = savedPos.right;
                if (savedPos.bottom) container.style.bottom = savedPos.bottom;
                if (savedPos.width) container.style.width = savedPos.width;
                if (savedPos.height) container.style.height = savedPos.height;
            }

            container.innerHTML = getHTMLTemplate();

            // --- Isolamento contra DarkReader ---
            container.setAttribute('data-darkreader-ignore', '');
            container.setAttribute('data-darkreader-mode', '0');
            container.style.colorScheme = isDarkMode ? 'dark' : 'light';

            document.body.appendChild(container);

            // Inicializar MacroSuggester
            MacroSuggester.init();

            // Z-index: bloco de notas fica na frente ao clicar
            container.addEventListener('mousedown', () => {
                container.style.zIndex = "10000";
                const finPanel = document.getElementById('painel-financeiro');
                if (finPanel) finPanel.style.zIndex = "9999";
            });

            // =============================================================
            // REFERÊNCIAS DOM (UI)
            // =============================================================

            const ui = {
                areaTexto: document.getElementById('area-texto'),
                listaHist: document.getElementById('lista-hist'),
                tabsContainer: document.getElementById('tabs-container'),
                screenMacros: document.getElementById('screen-macros'),
                screenAgenda: document.getElementById('screen-agenda'),
                listMacros: document.getElementById('list-macros'),
                listAgenda: document.getElementById('list-agenda'),
                inputKey: document.getElementById('new-macro-key'),
                inputVal: document.getElementById('new-macro-val'),
                inputAgendaTxt: document.getElementById('agenda-input-text'),
                inputAgendaDate: document.getElementById('agenda-input-date'),
                inputAgendaTime: document.getElementById('agenda-input-time')
            };


            // =============================================================
            // TEMA
            // =============================================================

            document.getElementById('btn-theme').onclick = async (e) => {
                e.stopPropagation();
                let novoModo = !isDarkMode;
                await SafeStorage.set(CONFIG_APP.STORAGE_THEME, novoModo);
                document.dispatchEvent(new CustomEvent('flowdeskThemeChanged', { detail: { isDark: novoModo } }));
            };

            document.addEventListener('flowdeskThemeChanged', (e) => {
                isDarkMode = e.detail.isDark;
                container.classList.toggle('dark-mode', isDarkMode);
                container.style.colorScheme = isDarkMode ? 'dark' : 'light';

                const macroPanel = document.getElementById('macro-suggestion-panel');
                if (macroPanel) {
                    macroPanel.classList.toggle('dark-mode', isDarkMode);
                    macroPanel.style.colorScheme = isDarkMode ? 'dark' : 'light';
                }

                const btnTheme = document.getElementById('btn-theme');
                if (btnTheme) btnTheme.innerHTML = isDarkMode ? globalThis.LucideIcons.get('moon', 14) : globalThis.LucideIcons.get('sun', 14);
            });

            // =============================================================
            // MODAL (Confirmar / Prompt)
            // =============================================================



            // =============================================================
            // RENDERIZAÇÃO: ABAS
            // =============================================================

            function getActiveTab() {
                return appData.tabs.find(t => t.id === appData.activeTabId) || appData.tabs[0];
            }

            function renderTabs() {
                ui.tabsContainer.innerHTML = '';

                appData.tabs.forEach(tab => {
                    const tabEl = document.createElement('div');
                    tabEl.className = `tab-item ${tab.id === appData.activeTabId ? 'active' : ''}`;
                    tabEl.innerHTML = `<span class="tab-text">${escapeHTML(tab.title)}</span><span class="tab-close">×</span>`;

                    // Clique: ativar aba
                    tabEl.onclick = (e) => {
                        if (e.target.classList.contains('tab-close')) return;
                        appData.activeTabId = tab.id;
                        salvarDados();
                        updateUI();
                    };

                    // Duplo clique: renomear aba
                    tabEl.ondblclick = () => {
                        ModalService.prompt('Renomear', tab.title, (val) => {
                            if (val && val.trim()) {

                                tab.title = val.trim();
                                salvarDados();
                                renderTabs();
                            }
                        }, 'bloco-notas');
                    };

                    // Botão fechar aba
                    tabEl.querySelector('.tab-close').onclick = (e) => {
                        e.stopPropagation();
                        if (appData.tabs.length <= 1) return;
                        ModalService.confirm('Excluir Aba?', `Apagar "${tab.title}"?`, () => {
                            appData.tabs = appData.tabs.filter(t => t.id !== tab.id);

                            if (appData.activeTabId === tab.id) {
                                appData.activeTabId = appData.tabs[0].id;
                            }
                            reordenarAbas();
                            updateUI();
                            ToastService.success("Aba excluída.", "bloco-notas");
                        }, 'bloco-notas');
                    };


                    ui.tabsContainer.appendChild(tabEl);
                });

                // Botão "+" para nova aba
                if (appData.tabs.length < CONFIG_APP.MAX_TABS) {
                    const addBtn = document.createElement('div');
                    addBtn.className = 'tab-add';
                    addBtn.innerText = '+';
                    addBtn.onclick = () => {
                        const newId = Date.now();
                        appData.tabs.push({ id: newId, title: 'Guia TEMP', content: '', history: [] });
                        appData.activeTabId = newId;
                        reordenarAbas();
                        updateUI();
                    };
                    ui.tabsContainer.appendChild(addBtn);
                }
            }

            // =============================================================
            // RENDERIZAÇÃO: HISTÓRICO
            // =============================================================

            function renderHistory() {
                ui.listaHist.innerHTML = '';

                getActiveTab().history.forEach((itemObj, index) => {
                    const item = document.createElement('div');
                    item.className = 'hist-item';
                    item.innerHTML = `
                        <div class="hist-title-container">
                            <span class="hist-title">${escapeHTML(itemObj.title || 'Sem título')}</span>
                            <span class="hist-preview">${escapeHTML(itemObj.content.substring(0, 30))}...</span>
                        </div>
                        <div class="hist-actions">
                            <span class="btn-icon btn-load">📂</span>
                            <span class="btn-icon btn-rename">✏️</span>
                            <span class="btn-icon btn-del">❌</span>
                        </div>
                    `;

                    // Clique: copiar conteúdo
                    item.onclick = async (e) => {
                        if (e.target.classList.contains('btn-icon')) return;
                        await navigator.clipboard.writeText(itemObj.content);
                        item.style.backgroundColor = '#c6f6d5';
                        setTimeout(() => item.style.backgroundColor = '', 300);
                    };

                    // Carregar no editor
                    item.querySelector('.btn-load').onclick = (e) => {
                        e.stopPropagation();
                        ui.areaTexto.value = itemObj.content;
                        getActiveTab().content = itemObj.content;
                        salvarDados();
                    };

                    // Renomear
                    item.querySelector('.btn-rename').onclick = (e) => {
                        e.stopPropagation();
                        ModalService.prompt('Renomear', itemObj.title, (v) => {
                            if (v) {

                                itemObj.title = v;
                                salvarDados();
                                renderHistory();
                            }
                        }, 'bloco-notas');
                    };

                    // Deletar
                    item.querySelector('.btn-del').onclick = (e) => {
                        e.stopPropagation();
                        ModalService.confirm('Excluir?', `Apagar "${itemObj.title}"?`, () => {
                            getActiveTab().history.splice(index, 1);

                            salvarDados();
                            renderHistory();
                            ToastService.success("Item removido do histórico.", "bloco-notas");
                        }, 'bloco-notas');
                    };

                    ui.listaHist.appendChild(item);
                });
            }

            function updateUI() {
                ui.areaTexto.value = getActiveTab().content;
                renderTabs();
                renderHistory();
            }
            updateUI();

            // =============================================================
            // RENDERIZAÇÃO: MACROS
            // =============================================================

            function renderMacrosList() {
                ui.listMacros.innerHTML = macrosList.length
                    ? ''
                    : '<div style="color:#a0aec0; text-align:center; padding:20px; font-size: var(--fd-font-size-sm);">Vazio</div>';

                let dragStartIndex = -1;

                macrosList.forEach((macro, index) => {
                    const div = document.createElement('div');
                    div.className = 'macro-item';
                    div.setAttribute('draggable', 'true');
                    div.innerHTML = `
                        <div class="macro-info" style="display: flex; align-items: center; gap: 8px;">
                            <span class="macro-drag-handle" style="cursor: grab; color: var(--bn-text-sec); font-size: var(--fd-font-size-lg); user-select: none;">&#9776;</span>
                            <span class="macro-key">${escapeHTML(macro.key)}</span>
                            <span class="macro-val">${escapeHTML(macro.val)}</span>
                        </div>
                        <div class="macro-actions-group">
                            <span class="macro-btn del">${globalThis.LucideIcons.get('trash-2', 16)}</span>
                        </div>
                    `;

                    // Drag and Drop Events
                    div.addEventListener('dragstart', (e) => {
                        dragStartIndex = index;
                        e.dataTransfer.effectAllowed = 'move';
                        div.style.opacity = '0.5';
                    });

                    div.addEventListener('dragover', (e) => {
                        e.preventDefault(); // allow drop
                        e.dataTransfer.dropEffect = 'move';
                        div.style.borderTop = dragStartIndex > index ? '2px solid var(--bn-accent)' : '';
                        div.style.borderBottom = dragStartIndex < index ? '2px solid var(--bn-accent)' : '';
                    });

                    div.addEventListener('dragleave', (e) => {
                        div.style.borderTop = '';
                        div.style.borderBottom = '';
                    });

                    div.addEventListener('drop', (e) => {
                        e.preventDefault();
                        div.style.borderTop = '';
                        div.style.borderBottom = '';
                        if (dragStartIndex !== -1 && dragStartIndex !== index) {
                            const item = macrosList.splice(dragStartIndex, 1)[0];
                            macrosList.splice(index, 0, item);
                            salvarMacros();
                            renderMacrosList();
                        }
                    });

                    div.addEventListener('dragend', () => {
                        div.style.opacity = '1';
                        dragStartIndex = -1;
                    });

                    div.querySelector('.del').onclick = (e) => {
                        e.stopPropagation();
                        ModalService.confirm('Excluir?', `Deseja excluir o macro "${macro.key}"?`, () => {
                            macrosList.splice(index, 1);

                            salvarMacros();
                            renderMacrosList();
                            ToastService.success("Macro excluída.", "bloco-notas");
                        }, 'bloco-notas');
                    };

                    div.onclick = (e) => {
                        if (!e.target.classList.contains('macro-btn') && !e.target.classList.contains('macro-drag-handle')) {
                            ui.inputKey.value = macro.key;
                            ui.inputVal.value = macro.val;
                        }
                    };

                    ui.listMacros.appendChild(div);
                });
            }

            // =============================================================
            // RENDERIZAÇÃO: AGENDA
            // =============================================================

            function getTodayStr() {
                const tzoffset = (new Date()).getTimezoneOffset() * 60000;
                return (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
            }

            function getTomorrowStr() {
                const tzoffset = (new Date()).getTimezoneOffset() * 60000;
                return (new Date(Date.now() + 86400000 - tzoffset)).toISOString().split('T')[0];
            }

            function renderAgenda() {
                const list = agendaData.items;
                const todayStr = getTodayStr();
                const tomorrowStr = getTomorrowStr();

                const overdueItems = list.filter(i => !i.done && isDue(i));
                const pendingItems = list.filter(i => !i.done && !isDue(i));
                const doneItems = list.filter(i => i.done);

                const todayItems = pendingItems.filter(i => i.date === todayStr);
                const tomorrowItems = pendingItems.filter(i => i.date === tomorrowStr);
                const upcomingItems = pendingItems.filter(i => i.date !== todayStr && i.date !== tomorrowStr);

                ui.listAgenda.innerHTML = list.length === 0
                    ? '<div style="color:#a0aec0; text-align:center; padding:20px; font-size: var(--fd-font-size-sm);">Nenhuma tarefa.</div>'
                    : '';

                const addGroup = (title, items) => {
                    if (items.length === 0) return;
                    const header = document.createElement('div');
                    header.innerHTML = `<div style="font-size: var(--fd-font-size-xs); font-weight:bold; color:var(--bn-text-sec); margin: 8px 0 4px 0; text-transform:uppercase;">${title}</div>`;
                    ui.listAgenda.appendChild(header);
                    items.forEach(item => ui.listAgenda.appendChild(createAgendaItem(item, list)));
                };

                addGroup('🔴 Vencidas', overdueItems);
                addGroup('🟢 Hoje', todayItems);
                addGroup('🟡 Amanhã', tomorrowItems);
                addGroup('🔵 Próximos Dias', upcomingItems);
                addGroup('🟣 Concluídas', doneItems);
            }

            /**
             * Cria um elemento DOM para item da agenda.
             * @param {Object} item - Item da agenda
             * @param {Array} originalList - Lista original para remoção por referência
             * @returns {HTMLElement}
             */
            function createAgendaItem(item, originalList) {
                const div = document.createElement('div');
                div.dataset.id = item.id;
                const dueClass = isDue(item) ? 'due' : '';
                div.className = `agenda-item ${item.done ? 'completed' : ''} ${dueClass}`;

                const dateDisplay = item.date
                    ? `<span class="agenda-tag">${item.date.split('-').reverse().join('/')}</span>`
                    : '';
                const timeDisplay = item.time
                    ? `<span class="agenda-tag">${item.time}</span>`
                    : '';

                div.innerHTML = `
                    <div class="agenda-check-container">
                        <input type="checkbox" class="agenda-checkbox" ${item.done ? 'checked' : ''}>
                    </div>
                    <div class="agenda-info">
                        <div class="agenda-text ${item.done ? 'riscado' : ''}">${escapeHTML(item.text)}</div>
                        <div class="agenda-meta">${dateDisplay} ${timeDisplay}</div>
                    </div>
                    <div class="agenda-actions">
                        <span class="macro-btn edit" title="Editar">✏️</span>
                        <span class="macro-btn del" title="Excluir">${globalThis.LucideIcons.get('trash-2', 16)}</span>
                    </div>
                `;

                div.querySelector('.agenda-checkbox').onclick = (e) => {
                    e.stopPropagation();
                    item.done = !item.done;
                    salvarAgenda();
                    renderAgenda();
                    checkReminders();
                };

                div.querySelector('.edit').onclick = (e) => {
                    e.stopPropagation();
                    ModalService.prompt('Editar Lembrete', item.text, (newText) => {
                        if (newText && newText.trim()) {

                            item.text = newText.trim();
                            salvarAgenda();
                            renderAgenda();
                        }
                    }, 'bloco-notas');
                };

                div.querySelector('.del').onclick = (e) => {
                    e.stopPropagation();
                    ModalService.confirm('Excluir Lembrete?', `Deseja excluir "${item.text}"?`, () => {
                        const idx = originalList.indexOf(item);

                        if (idx > -1) originalList.splice(idx, 1);
                        salvarAgenda();
                        renderAgenda();
                        checkReminders();
                        ToastService.success("Lembrete excluído!", "bloco-notas");
                    }, 'bloco-notas');
                };

                return div;
            }

            // =============================================================
            // NAVEGAÇÃO: TELAS (Macros / Agenda / Painel)
            // =============================================================

            /** Fecha todas as sub-telas e volta à visão principal */
            function closeAllScreens() {
                ui.screenAgenda.style.display = 'none';
                ui.screenMacros.style.display = 'none';
                ui.tabsContainer.style.display = 'flex';
                checkReminders();
            }

            /** Fecha o painel inteiro */
            function closePanel() {
                const cont = document.getElementById(CONFIG_APP.DOM_ID.CONTAINER);
                if (cont) {
                    cont.style.display = 'none';
                    closeAllScreens();
                }
                checkReminders();
            }

            // --- Botões de Agenda ---
            document.getElementById('btn-agenda').onclick = () => {
                ui.screenAgenda.style.display = 'flex';
                ui.tabsContainer.style.display = 'none';
                ui.screenMacros.style.display = 'none';
                renderAgenda();
                setTimeout(checkReminders, 50);
            };

            const closeAgenda = () => closeAllScreens();
            document.querySelector('.btn-close-agenda').onclick = closeAgenda;
            document.querySelector('#screen-agenda .macros-title').onclick = closeAgenda;
            document.querySelector('#screen-agenda .macros-title').style.cursor = 'pointer';

            document.getElementById('btn-add-agenda').onclick = () => {
                const txt = ui.inputAgendaTxt.value.trim();
                const date = ui.inputAgendaDate.value;
                const time = ui.inputAgendaTime.value;
                if (txt) {
                    agendaData.items.push({
                        id: Date.now(),
                        text: txt,
                        date: date,
                        time: time,
                        done: false
                    });
                    salvarAgenda();
                    renderAgenda();
                    checkReminders();
                    ui.inputAgendaTxt.value = '';
                    ui.inputAgendaDate.value = '';
                    ui.inputAgendaTime.value = '';
                    ui.inputAgendaTxt.focus();
                }
            };

            // --- Botões de Macros ---
            document.getElementById('btn-macros').onclick = () => {
                ui.screenMacros.style.display = 'flex';
                ui.screenAgenda.style.display = 'none';
                ui.tabsContainer.style.display = 'none';
                renderMacrosList();
            };

            const closeMacros = () => closeAllScreens();
            document.querySelector('.btn-close-macros').onclick = closeMacros;
            document.querySelector('#screen-macros .macros-title').onclick = closeMacros;
            document.querySelector('#screen-macros .macros-title').style.cursor = 'pointer';

            document.getElementById('btn-add-macro').onclick = () => {
                const k = ui.inputKey.value.trim();
                const v = ui.inputVal.value.trim();
                if (k && v) {
                    const idx = macrosList.findIndex(m => m.key === k);
                    if (idx > -1) {
                        macrosList[idx].val = v;
                    } else {
                        macrosList.push({ key: k, val: v });
                    }
                    salvarMacros();
                    renderMacrosList();
                    ui.inputKey.value = '';
                    ui.inputVal.value = '';
                }
            };

            // =============================================================
            // EVENT HANDLERS: ÁREA DE TEXTO E HISTÓRICO
            // =============================================================

            // Salvar conteúdo ao digitar
            ui.areaTexto.addEventListener('input', () => {
                getActiveTab().content = ui.areaTexto.value;
                salvarDados();
            });

            // Salvar colagens no histórico
            ui.areaTexto.addEventListener('paste', (e) => {
                const txt = (e.clipboardData || window.clipboardData).getData('text');
                if (txt && txt.trim().length > 10) {
                    const t = getActiveTab();
                    if (!t.history.length || t.history[0].content !== txt) {
                        t.history.unshift({
                            title: txt.substring(0, 20) + '...',
                            content: txt
                        });
                        if (t.history.length > CONFIG_APP.MAX_HISTORY) t.history.pop();
                        salvarDados();
                        renderHistory();
                    }
                }
            });

            // ✨ Melhorar com Groq (Llama 3.1)
            document.getElementById('btn-melhorar-gemini').onclick = () => {
                const texto = ui.areaTexto.value;
                if (!texto || !texto.trim()) {
                    ToastService.warning('Bloco vazio.', 'bloco-notas');
                    return;
                }
                const btn = document.getElementById('btn-melhorar-gemini');
                btn.innerText = '⏳ Melhorando...';
                btn.disabled = true;

                GroqService.improve(
                    texto,
                    (resultado) => {
                        // Salvar original no histórico antes de substituir
                        const t = getActiveTab();
                        const agora = new Date().toLocaleTimeString('pt-BR').substring(0, 5);
                        t.history.unshift({ title: `Antes do Groq — ${agora}`, content: texto });
                        if (t.history.length > CONFIG_APP.MAX_HISTORY) t.history.pop();

                        // Aplicar resultado
                        applyMacroToInput(ui.areaTexto, resultado);
                        t.content = resultado;
                        salvarDados();
                        renderHistory();

                        ToastService.success('Texto melhorado!', 'bloco-notas');
                        btn.innerHTML = `<div style="display:flex; align-items:center; gap:4px;">${globalThis.LucideIcons.get('sparkles', 14)} Melhorar</div>`;
                        btn.disabled = false;
                    },
                    (erro) => {
                        ToastService.error(erro, 'bloco-notas');
                        btn.innerHTML = `<div style="display:flex; align-items:center; gap:4px;">${globalThis.LucideIcons.get('sparkles', 14)} Melhorar</div>`;
                        btn.disabled = false;
                    }
                );
            };

            // Copiar rascunho
            document.getElementById('btn-copy-draft').onclick = async () => {
                if (ui.areaTexto.value) {
                    await navigator.clipboard.writeText(ui.areaTexto.value);
                    const b = document.getElementById('btn-copy-draft');
                    const t = b.innerText;
                    b.innerText = "Copiado!";
                    b.style.color = "green";
                    setTimeout(() => {
                        b.innerText = t;
                        b.style.color = "";
                    }, 1000);
                }
            };

            // Limpar histórico
            document.getElementById('limpar-hist').onclick = () => {
                ModalService.confirm('Limpar Histórico?', 'Tudo será apagado. Deseja continuar?', () => {
                    getActiveTab().history = [];

                    salvarDados();
                    renderHistory();
                }, 'bloco-notas');
            };


            // Fechar painel
            document.getElementById('fechar-bloco').onclick = closePanel;

            // =============================================================
            // DRAG DO BLOCO DE NOTAS
            // =============================================================

            const setupDragClassic = (trigger, target, saveKey) => {
                let isDragging = false, startX, startY, startLeft, startTop;

                const onMove = (e) => {
                    if (!isDragging) return;
                    e.preventDefault();

                    const scale = globalThis.getPanelScale ? globalThis.getPanelScale() : 1.0;
                    const winW = window.innerWidth / scale;
                    const winH = window.innerHeight / scale;
                    const tW = target.offsetWidth;
                    const tH = target.offsetHeight;

                    let newLeft = startLeft + (e.clientX - startX) / scale;
                    let newTop = startTop + (e.clientY - startY) / scale;

                    // Clampar dentro da viewport
                    newLeft = Math.max(0, Math.min(newLeft, winW - tW));
                    newTop = Math.max(0, Math.min(newTop, winH - tH));

                    target.style.left = newLeft + 'px';
                    target.style.top = newTop + 'px';
                    target.style.right = 'auto';
                    target.style.bottom = 'auto';
                };

                const onUp = async () => {
                    if (isDragging) {
                        isDragging = false;
                        trigger.style.cursor = 'move';
                        target.classList.remove('em-movimento');
                        globalThis.clampToViewport(target);
                        await SafeStorage.set(saveKey, {
                            top: target.style.top,
                            left: target.style.left,
                            right: target.style.right,
                            bottom: target.style.bottom,
                            width: target.style.width,
                            height: target.style.height
                        });
                    }
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };

                trigger.onmousedown = (e) => {
                    if (e.target.closest('.tab-item, .tab-add, #modal-confirm, .btn-mini, #btn-theme, #fechar-bloco, .btn-backup')) return;
                    isDragging = true;
                    target.classList.add('em-movimento');
                    startX = e.clientX;
                    startY = e.clientY;
                    startLeft = target.offsetLeft;
                    startTop = target.offsetTop;
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                };
            };

            setupDragClassic(document.getElementById('cabecalho-bloco'), container, CONFIG_APP.STORAGE_POS);
        }

        // -----------------------------------------------------------------
        // HTML TEMPLATE DO BLOCO DE NOTAS
        // -----------------------------------------------------------------

        /**
         * Retorna o HTML completo do bloco de notas.
         * @returns {string}
         */
        function getHTMLTemplate() {
            return `
                <div id="cabecalho-bloco">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span>📝 Notas & Rascunhos</span>
                        <span id="btn-theme" style="cursor:pointer; display:flex; align-items:center; opacity:0.8;" title="Alternar Tema">${isDarkMode ? globalThis.LucideIcons.get('moon', 14) : globalThis.LucideIcons.get('sun', 14)}</span>
                    </div>
                    <span id="fechar-bloco" style="cursor:pointer; display:flex; align-items:center; opacity:0.8;">${globalThis.LucideIcons.get('x', 14)}</span>
                </div>
                <div id="tabs-container"></div>
                <div id="corpo-bloco">
                    <div id="screen-macros">
                        <div id="header-macros">
                            <div style="display:flex; gap:5px; align-items:center;">
                                <span class="macros-title" style="display:flex; align-items:center; gap:4px;" title="Voltar">${globalThis.LucideIcons.get('zap', 14)} Gerenciador</span>
                            </div>
                            <span class="btn-close-macros" style="display:flex; align-items:center;">${globalThis.LucideIcons.get('x', 14)}</span>
                        </div>
                        <div id="list-macros"></div>
                        <div id="add-macro-form">
                            <input type="text" id="new-macro-key" class="input-macro" placeholder="Atalho (ex: ;oi)">
                            <textarea id="new-macro-val" class="input-macro" placeholder="Texto"></textarea>
                            <button id="btn-add-macro" class="btn-add-macro">Adicionar</button>
                        </div>
                    </div>
                    <div id="screen-agenda">
                        <div id="header-macros">
                            <div style="display:flex; gap:10px; align-items:center;">
                                <span class="macros-title" style="display:flex; align-items:center; gap:4px;" title="Voltar">${globalThis.LucideIcons.get('calendar', 14)} Agenda</span>
                            </div>
                            <span class="btn-close-agenda btn-close-macros" style="display:flex; align-items:center;">${globalThis.LucideIcons.get('x', 14)}</span>
                        </div>
                        <div id="list-agenda"></div>
                        <div id="add-macro-form">
                            <input type="text" id="agenda-input-text" class="input-macro" placeholder="Nova tarefa...">
                            <div style="display:flex; gap:5px; margin-top:5px;">
                                <input type="date" id="agenda-input-date" class="input-macro" style="width:60%;">
                                <input type="time" id="agenda-input-time" class="input-macro" style="width:40%;">
                            </div>
                            <button id="btn-add-agenda" class="btn-add-macro" style="margin-top:5px;">Adicionar Lembrete</button>
                        </div>
                    </div>

                    <div id="toolbar-bloco">
                        <div style="display:flex; gap:4px;">
                            <button id="btn-macros" class="btn-mini" style="display:flex; align-items:center; gap:4px;">${globalThis.LucideIcons.get('zap', 12)} Macros</button>
                            <button id="btn-agenda" class="btn-mini" style="display:flex; align-items:center; gap:4px;">${globalThis.LucideIcons.get('calendar', 12)} Agenda</button>
                            <button id="btn-melhorar-gemini" class="btn-mini" style="display:flex; align-items:center; gap:4px;" title="Melhorar texto com IA">${globalThis.LucideIcons.get('sparkles', 12)} Melhorar</button>
                        </div>
                        <button id="btn-copy-draft" class="btn-mini">Copiar</button>
                    </div>
                    <textarea id="area-texto" spellcheck="false" placeholder="Digite aqui..."></textarea>
                    <div id="historico-container">
                        <div id="titulo-hist">Histórico <span id="limpar-hist" style="cursor:pointer; color:#e53e3e;">LIMPAR</span></div>
                        <div id="lista-hist"></div>
                    </div>
                </div>
            `;
        }

        // --- API PÚBLICA DO MÓDULO ---
        return {
            init: async () => {
                isDarkMode = await globalThis.SafeStorage.get(globalThis.CONFIG_APP.STORAGE_THEME, false);
                carregarDados();
                setInterval(checkReminders, 3000);
                setTimeout(checkReminders, 1000);
                document.addEventListener('flowdeskRefreshNotifications', checkReminders);
                if (document.body) {
                    injetarBloco();
                } else {
                    const observer = new MutationObserver(() => {
                        if (document.body) {
                            injetarBloco();
                            observer.disconnect();
                        }
                    });
                    observer.observe(document.documentElement, { childList: true, subtree: true });
                }
            }
        };
})();
