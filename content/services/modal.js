// FlowDesk MV3 — modal.js

/**
 * ModalService — Centralizador de Modais de Confirmação e Prompt.
 * Permite exibir modais padronizados em qualquer parte do sistema.
 */
if (!globalThis.ModalService) {

const ModalService = {
    ui: null,
    callback: null,

    /** Inicializa a estrutura do modal no DOM */
    init() {
        if (document.getElementById('modal-confirm-global')) {
            this.ui = {
                container: document.getElementById('modal-confirm-global'),
                title: document.getElementById('modal-title-global'),
                desc: document.getElementById('modal-desc-global'),
                input: document.getElementById('modal-input-global'),
                btnConfirm: document.getElementById('modal-btn-confirm-global'),
                btnCancel: document.getElementById('modal-btn-cancel-global')
            };
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'modal-confirm-global';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            z-index: 2147483647 !important; display: none; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            color-scheme: light; isolation: isolate;
        `;
        modal.style.setProperty('z-index', '2147483647', 'important');

        modal.innerHTML = `
            <div class="modal-content-global" style="
                background: var(--fd-bg, #ffffff); padding: 18px; border-radius: 12px;
                width: 300px; max-width: calc(100% - 20px); text-align: center; border: 1px solid var(--fd-border, #e2e8f0);
                box-shadow: 0 10px 25px rgba(0,0,0,0.25); box-sizing: border-box;
            ">
                <div id="modal-title-global" style="font-weight: 700; font-size: 14px; margin-bottom: 8px; color: var(--fd-text, #1a202c);"></div>
                <div id="modal-desc-global" style="font-size: 12px; margin-bottom: 14px; color: var(--fd-text-muted, #718096); line-height: 1.4; word-break: break-word;"></div>
                <input type="text" id="modal-input-global" style="
                    display: none; width: 100%; padding: 8px; border-radius: 6px;
                    border: 1px solid var(--fd-border, #e2e8f0); margin-bottom: 14px;
                    background: var(--fd-bg, #ffffff); color: var(--fd-text, #1a202c); box-sizing: border-box;
                ">
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button id="modal-btn-cancel-global" style="
                        padding: 7px 15px; border-radius: 6px; font-size: 11px; font-weight: 700;
                        cursor: pointer; border: 1px solid var(--fd-border, #e2e8f0);
                        background: var(--fd-bg-secondary, #f7fafc); color: var(--fd-text-muted, #718096);
                    ">Cancelar</button>
                    <button id="modal-btn-confirm-global" style="
                        padding: 7px 15px; border-radius: 6px; font-size: 11px; font-weight: 700;
                        cursor: pointer; border: none; color: white;
                    ">Confirmar</button>
                </div>
            </div>
        `;

        modal.setAttribute('data-darkreader-ignore', '');
        modal.setAttribute('data-darkreader-mode', '0');
        modal.style.colorScheme = 'light';
        document.body.appendChild(modal);

        this.ui = {
            container: modal,
            title: document.getElementById('modal-title-global'),
            desc: document.getElementById('modal-desc-global'),
            input: document.getElementById('modal-input-global'),
            btnConfirm: document.getElementById('modal-btn-confirm-global'),
            btnCancel: document.getElementById('modal-btn-cancel-global')
        };

        this.ui.btnCancel.onclick = () => this.hide();
        this.ui.btnConfirm.onclick = () => {
            if (this.callback) {
                const val = this.ui.input.style.display !== 'none' ? this.ui.input.value : undefined;
                this.callback(val);
            }
            this.hide();
        };
        this.ui.input.onkeydown = (e) => { if (e.key === 'Enter') this.ui.btnConfirm.click(); };
    },

    _applyPosition(containerId) {
        if (containerId) {
            const containerEl = document.getElementById(containerId);
            if (containerEl && containerEl.style.display !== 'none') {
                const rect = containerEl.getBoundingClientRect();
                if (rect.width > 200 && rect.height > 150) {
                    this.ui.container.style.top = rect.top + 'px';
                    this.ui.container.style.left = rect.left + 'px';
                    this.ui.container.style.width = rect.width + 'px';
                    this.ui.container.style.height = rect.height + 'px';
                    this.ui.container.style.borderRadius = window.getComputedStyle(containerEl).borderRadius || '12px';
                    this.ui.container.style.overflow = 'hidden';
                    return;
                }
            }
        }
        // Fallback: Full screen
        this.ui.container.style.top = '0';
        this.ui.container.style.left = '0';
        this.ui.container.style.width = '100%';
        this.ui.container.style.height = '100%';
        this.ui.container.style.borderRadius = '0';
        this.ui.container.style.overflow = 'visible';
    },

    confirm(title, desc, callback, containerId = null) {
        this.init();
        if (this.ui.container && document.body) {
            document.body.appendChild(this.ui.container);
            this.ui.container.style.setProperty('z-index', '2147483647', 'important');
        }
        this._applyPosition(containerId);
        this.ui.title.innerText = title;
        this.ui.desc.innerText = desc;
        this.ui.desc.style.display = 'block';
        this.ui.input.style.display = 'none';
        this.ui.btnConfirm.innerText = 'Confirmar';
        this.ui.btnConfirm.style.background = '#e53e3e';
        this.callback = callback;
        this.ui.container.style.display = 'flex';
    },

    prompt(title, initialVal, callback, containerId = null) {
        this.init();
        if (this.ui.container && document.body) {
            document.body.appendChild(this.ui.container);
            this.ui.container.style.setProperty('z-index', '2147483647', 'important');
        }
        this._applyPosition(containerId);
        this.ui.title.innerText = title;
        this.ui.desc.style.display = 'none';
        this.ui.input.style.display = 'block';
        this.ui.input.value = initialVal || '';
        this.ui.btnConfirm.innerText = 'Salvar';
        this.ui.btnConfirm.style.background = 'var(--fd-danger, #dd6b20)';
        this.callback = callback;
        this.ui.container.style.display = 'flex';
        setTimeout(() => this.ui.input.focus(), 100);
    },

    hide() {
        if (this.ui) this.ui.container.style.display = 'none';
        this.callback = null;
    }
};

globalThis.ModalService = ModalService;

}
