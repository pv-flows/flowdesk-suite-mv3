// FlowDesk MV3 — content/services/groq.js
// Etapa 1 (v5.2.7) — Padronização com globalThis e integração ao Service Worker

if (!globalThis.GroqService) {

const GroqService = {
    /**
     * Envia texto para revisão/sugestão via Groq através do Service Worker.
     * @param {string} promptText
     * @param {string} [systemPrompt]
     */
    async fetchAISuggestion(promptText, systemPrompt) {
        try {
            const { groq_api_key } = await chrome.storage.local.get('groq_api_key');
            if (!groq_api_key) {
                return { ok: false, error: 'Chave Groq não configurada nas Configurações.' };
            }

            return await new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    {
                        action: 'groq',
                        text: promptText,
                        apiKey: groq_api_key,
                        model: 'llama-3.3-70b-versatile',
                        systemPrompt: systemPrompt || 'Você é um assistente profissional de atendimento e negociação. Revise o texto mantendo o sentido original.'
                    },
                    (res) => resolve(res || { ok: false, error: 'Sem resposta do Service Worker.' })
                );
            });
        } catch (error) {
            console.error('[FlowDesk GroqService] Erro:', error);
            return { ok: false, error: error.message };
        }
    },

    async improve(text, onSuccess, onError) {
        const res = await this.fetchAISuggestion(text);
        if (res?.ok) {
            onSuccess?.(res.data);
        } else {
            onError?.(res?.error || 'Erro ao processar texto com IA.');
        }
    }
};

globalThis.GroqService = GroqService;

}
