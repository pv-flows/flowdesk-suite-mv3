// FlowDesk MV3 — utils.js

if (!globalThis.getVencimento3DiasUteis) {

/**
 * Calcula a data de vencimento considerando 3 dias úteis a partir de hoje.
 * Ignora fins de semana e feriados nacionais.
 * @returns {Promise<string>} Data formatada em pt-BR (dd/mm/aaaa)
 */
async function getVencimento3DiasUteis() {
    const data = new Date();
    let diasAdicionados = 0;
    let feriadosAno = null;
    let anoAtual = null;

    while (diasAdicionados < 3) {
        data.setDate(data.getDate() + 1);
        const diaSemana = data.getDay();
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();

        // Recarregar feriados se o ano mudou (travessia de virada de ano)
        if (ano !== anoAtual) {
            feriadosAno = await globalThis.HolidayService.getHolidaySet(ano);
            anoAtual = ano;
        }

        const dataFormatada = `${dia}/${mes}/${ano}`;
        if (diaSemana !== 0 && diaSemana !== 6 && !feriadosAno.has(dataFormatada)) {
            diasAdicionados++;
        }
    }
    return data.toLocaleDateString('pt-BR');
}

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

/**
 * Cria versão debounced de uma função.
 * @param {Function} func - Função a ser adiada
 * @param {number} wait - Tempo de espera em ms
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Retorna a escala (zoom) atual aplicada aos painéis, para corrigir a matemática de arraste.
 */
function getPanelScale() {
    const scaleStr = getComputedStyle(document.documentElement).getPropertyValue('--fd-panel-scale').trim();
    const scale = parseFloat(scaleStr);
    return isNaN(scale) || scale <= 0 ? 1.0 : scale;
}

/**
 * Restringe um elemento dentro dos limites visíveis da viewport.
 * Garante que nenhuma borda do elemento ultrapasse a tela e ancora-o na borda mais próxima
 * para que mantenha sua posição relativa ao redimensionar a tela.
 * @param {HTMLElement} element - Elemento a ser contido na viewport
 */
function clampToViewport(element) {
    if (!element || element.style.display === 'none') return;
    const scale = getPanelScale();
    const rect = element.getBoundingClientRect();
    const winW = window.innerWidth / scale;
    const winH = window.innerHeight / scale;

    let left = rect.left / scale;
    let top = rect.top / scale;
    let rectW = rect.width / scale;
    let rectH = rect.height / scale;

    if (left < 0) left = 0;
    if (left + rectW > winW) left = Math.max(0, winW - rectW);
    if (top < 0) top = 0;
    if (top + rectH > winH) top = Math.max(0, winH - rectH);

    // Ancora na borda mais próxima (Esquerda vs Direita)
    if (left + rectW / 2 > winW / 2) {
        element.style.right = (winW - (left + rectW)) + 'px';
        element.style.left = 'auto';
    } else {
        element.style.left = left + 'px';
        element.style.right = 'auto';
    }

    // Ancora na borda mais próxima (Cima vs Baixo)
    if (top + rectH / 2 > winH / 2) {
        element.style.bottom = (winH - (top + rectH)) + 'px';
        element.style.top = 'auto';
    } else {
        element.style.top = top + 'px';
        element.style.bottom = 'auto';
    }
}

/**
 * Reposiciona todos os elementos fixos para dentro da viewport
 * quando a janela do navegador é redimensionada.
 */
function clampAllElementsToViewport() {
    const scale = getPanelScale();
    const winW = window.innerWidth / scale;
    const winH = window.innerHeight / scale;

    /**
     * Restringe um elemento individual dentro da viewport apenas se ele estiver fora,
     * preservando a sua ancoragem original.
     * @param {HTMLElement} el - Elemento a clampar
     * @param {boolean} dontResize - Se true, não permite reduzir as dimensões originais (útil para o Speed Dial circular)
     */
    function clampEl(el, dontResize = false) {
        if (!el || el.style.display === 'none') return;
        const rect = el.getBoundingClientRect();
        let left = rect.left / scale;
        let top = rect.top / scale;
        let width = rect.width / scale;
        let height = rect.height / scale;

        let mudouTamanho = false;

        // Se o elemento é maior que a viewport, reduzir o tamanho (se permitido)
        if (!dontResize) {
            if (width > winW) {
                el.style.width = Math.max(200, winW - 10) + 'px';
                width = winW - 10;
                mudouTamanho = true;
            }
            if (height > winH) {
                el.style.height = Math.max(200, winH - 10) + 'px';
                height = winH - 10;
                mudouTamanho = true;
            }
        }

        // Se o elemento estava fora da tela por causa do redimensionamento, empurramos de volta
        // Mas se ele já está dentro, NÃO alteramos suas coordenadas para não quebrar a persistência da borda direita/inferior.
        let needsClamp = mudouTamanho;
        if (left + width > winW) { left = Math.max(0, winW - width); needsClamp = true; }
        if (top + height > winH) { top = Math.max(0, winH - height); needsClamp = true; }
        if (left < 0) { left = 0; needsClamp = true; }
        if (top < 0) { top = 0; needsClamp = true; }

        if (needsClamp) {
            // Se tivemos que mexer na posição, recalculamos a ancoragem ideal
            if (left + width / 2 > winW / 2) {
                el.style.right = (winW - (left + width)) + 'px';
                el.style.left = 'auto';
            } else {
                el.style.left = left + 'px';
                el.style.right = 'auto';
            }

            if (top + height / 2 > winH / 2) {
                el.style.bottom = (winH - (top + height)) + 'px';
                el.style.top = 'auto';
            } else {
                el.style.top = top + 'px';
                el.style.bottom = 'auto';
            }
        }
    }

    // Clampar Painel Financeiro
    const painelFin = document.getElementById('painel-financeiro');
    if (painelFin && painelFin.style.display === 'flex') clampEl(painelFin, false);

    // Clampar Bloco de Notas
    const blocoNotas = document.getElementById('bloco-notas');
    if (blocoNotas && blocoNotas.style.display === 'flex') clampEl(blocoNotas, false);

    // Clampar Botão Speed Dial (sempre visível, mas sem alterar proporções)
    const btnFloat = document.getElementById('abrir-painel');
    if (btnFloat) clampEl(btnFloat, true);
}

// Debounce do resize para evitar execuções excessivas
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(clampAllElementsToViewport, 100);
});

/**
 * Aplica uma das 6 posições predefinidas ao elemento de painel.
 * @param {HTMLElement} element - Elemento do painel
 * @param {string} positionKey - 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
 */
function applyPanelPosition(element, positionKey) {
    if (!element) return;
    element.style.top = '';
    element.style.bottom = '';
    element.style.left = '';
    element.style.right = '';
    element.style.transform = '';

    const MARGIN = '10px';
    switch (positionKey) {
        case 'top-left':
            element.style.top = MARGIN;
            element.style.left = MARGIN;
            break;
        case 'top-center':
            element.style.top = MARGIN;
            element.style.left = '50%';
            element.style.transform = 'translateX(-50%)';
            break;
        case 'top-right':
            element.style.top = MARGIN;
            element.style.right = MARGIN;
            break;
        case 'bottom-left':
            element.style.bottom = MARGIN;
            element.style.left = MARGIN;
            break;
        case 'bottom-center':
            element.style.bottom = MARGIN;
            element.style.left = '50%';
            element.style.transform = 'translateX(-50%)';
            break;
        case 'bottom-right':
            element.style.bottom = MARGIN;
            element.style.right = MARGIN;
            break;
        default:
            element.style.top = MARGIN;
            element.style.right = MARGIN;
    }
}

globalThis.getVencimento3DiasUteis = getVencimento3DiasUteis;
globalThis.escapeHTML = escapeHTML;
globalThis.debounce = debounce;
globalThis.getPanelScale = getPanelScale;
globalThis.clampToViewport = clampToViewport;
globalThis.clampAllElementsToViewport = clampAllElementsToViewport;
globalThis.applyPanelPosition = applyPanelPosition;

}
