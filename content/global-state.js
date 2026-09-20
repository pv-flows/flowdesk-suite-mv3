// FlowDesk MV3 — global-state.js
// Sprint 1.3 — Webhook URL em runtime + token de autenticação

if (!globalThis.GlobalState) {

/**
 * Estado global da aplicação.
 * Gerencia identidade do operador e envio de telemetria.
 */
globalThis.GlobalState = {
    /**
     * Verifica se o operador está identificado (sem forçar prompt).
     * @returns {Promise<boolean>}
     */
    isLogged: async () => {
        const nome = await globalThis.SafeStorage.get('user_nome', null);
        const equipe = await globalThis.SafeStorage.get('user_equipe', null);
        return !!(nome && equipe);
    },

    /**
     * Retorna a identidade do operador atual.
     * @returns {Promise<{ nome: string, equipe: string }>}
     */
    getIdentity: async () => {
        return {
            nome: (await globalThis.SafeStorage.get('user_nome', null)) || "Operador",
            equipe: (await globalThis.SafeStorage.get('user_equipe', null)) || "Geral"
        };
    },

    /**
     * Envia ping de telemetria para o webhook.
     * @param {string} tipoAcao - Tipo da ação realizada
     * @param {string} metodoPagto - Método de pagamento utilizado
     * @param {number} [valor=0] - Valor monetário da ação
     */
    sendPing: async (tipoAcao, metodoPagto, valor = 0) => {
        const { webhook_url } = await chrome.storage.local.get('webhook_url');
        if (!webhook_url) return;
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
        }, (response) => {
            if (response && response.ok) {
                console.log(`[FlowDesk] Ping: ${tipoAcao} - ${metodoPagto}`);
            } else {
                console.log(`[FlowDesk] Erro Ping:`, response?.error);
            }
        });
    },

    /**
     * Envia dados completos da proposta financeira para a planilha Google.
     * @param {Object} dadosProposta - Objeto com todos os campos do painel
     */
    sendProposal: async (dadosProposta) => {
        const { webhook_url } = await chrome.storage.local.get('webhook_url');
        if (!webhook_url) return;
        const ident = await globalThis.GlobalState.getIdentity();

        chrome.runtime.sendMessage({
            action: 'fetch-post',
            url: webhook_url,
            body: {
                token: globalThis.WEBHOOK_DEFAULTS.TOKEN,
                tipo_registro: "proposta",
                operador: ident.nome,
                equipe: ident.equipe,
                ...dadosProposta
            }
        }, (response) => {
            if (response && response.ok) {
                console.log(`[FlowDesk] Proposta registrada na planilha`);
            } else {
                console.error(`[FlowDesk] Erro ao registrar proposta:`, response?.error);
            }
        });
    }
};

}
