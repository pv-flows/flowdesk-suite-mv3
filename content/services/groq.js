// content/services/groq.js

// Este arquivo atuará como um serviço para chamadas à API da Groq (Llama3).
// Todas as integrações de rede devem passar pelo background script em MV3.

window.GroqService = {
  async fetchAISuggestion(promptText) {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'FETCH_GROQ_SUGGESTION', payload: { prompt: promptText } },
          (res) => resolve(res)
        );
      });
      return response;
    } catch (error) {
      console.error('GroqService Error:', error);
      return { ok: false, error: error.message };
    }
  }
};
