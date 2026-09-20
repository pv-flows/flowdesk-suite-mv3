// FlowDesk MV3 — toast.js

/**
 * ToastService — Exibe notificações temporárias não-bloqueantes.
 */
if (!globalThis.ToastService) {

const ToastService = {
    show(mensagem, tipo = 'info', duracao = 1500, containerId = null) {
        const cores = {
            success: '#48bb78',
            error: '#fc8181',
            warning: '#f6ad55',
            info: '#6b46c1'
        };
        const toast = document.createElement('div');
        let positionStyle = `position: fixed; bottom: 24px; right: 24px; z-index: 99999;`;
        let targetContainer = document.body;

        if (containerId) {
            const containerEl = document.getElementById(containerId);
            if (containerEl) {
                const rect = containerEl.getBoundingClientRect();
                positionStyle = `
                    position: fixed;
                    bottom: ${window.innerHeight - rect.bottom + 12}px;
                    right: ${window.innerWidth - rect.right + 12}px;
                    z-index: 100000;
                `;
            }
        }

        toast.style.cssText = `
            ${positionStyle}
            background: ${cores[tipo]};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: Inter, sans-serif;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            animation: fadeIn 0.2s ease-out;
            max-width: 320px;
        `;
        toast.innerText = mensagem;
        toast.setAttribute('data-darkreader-ignore', '');
        toast.setAttribute('data-darkreader-mode', '0');
        toast.style.isolation = 'isolate';
        targetContainer.appendChild(toast);
        setTimeout(() => toast.remove(), duracao);
        if (!document.getElementById('toast-style')) {
            const style = document.createElement('style');
            style.id = 'toast-style';
            style.innerHTML = '@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }';
            document.head.appendChild(style);
        }
    },
    success(msg, containerId = null) { this.show(msg, 'success', 2000, containerId); },
    error(msg, containerId = null) { this.show(msg, 'error', 2000, containerId); },
    warning(msg, containerId = null) { this.show(msg, 'warning', 2000, containerId); },
    info(msg, containerId = null) { this.show(msg, 'info', 2000, containerId); }
};

globalThis.ToastService = ToastService;

}
