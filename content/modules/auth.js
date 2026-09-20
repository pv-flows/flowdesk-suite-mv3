// FlowDesk MV3 — auth.js
// Sprint 1.4 — Whitelist de operadores

if (!globalThis.AuthModule) {

globalThis.AuthModule = (function () {

    const WHITELIST_KEY = 'operadores_whitelist';

    /**
     * Valida se o operador está na whitelist.
     * Se a whitelist estiver vazia, retorna true (modo livre sem burocracia).
     * @param {string} nome - Nome do operador
     * @param {string} equipe - Equipe do operador
     * @returns {Promise<boolean>} true se válido ou whitelist vazia
     */
    async function validate(nome, equipe) {
        const whitelist = await globalThis.SafeStorage.get(WHITELIST_KEY, []);
        if (!Array.isArray(whitelist) || whitelist.length === 0) {
            return true;
        }
        const nomeNorm = (nome || '').trim().toLowerCase();
        const equipeNorm = (equipe || '').trim().toLowerCase();
        return whitelist.some(
            (entry) =>
                (entry.nome || '').trim().toLowerCase() === nomeNorm &&
                (entry.equipe || '').trim().toLowerCase() === equipeNorm
        );
    }

    /**
     * Retorna as equipes únicas da whitelist.
     * Se a whitelist estiver vazia, retorna as equipes padrão.
     * @returns {Promise<string[]>} Lista de equipes
     */
    async function getEquipes() {
        const whitelist = await globalThis.SafeStorage.get(WHITELIST_KEY, []);
        if (!Array.isArray(whitelist) || whitelist.length === 0) {
            return ['Digital', 'Presencial', 'Receptivo'];
        }
        const equipes = new Set();
        whitelist.forEach((entry) => {
            if (entry.equipe) {
                equipes.add(entry.equipe.trim());
            }
        });
        return Array.from(equipes);
    }

    /**
     * Adiciona um operador à whitelist.
     * @param {string} nome - Nome do operador
     * @param {string} equipe - Equipe do operador
     * @returns {Promise<void>}
     */
    async function addOperador(nome, equipe) {
        const whitelist = await globalThis.SafeStorage.get(WHITELIST_KEY, []);
        const lista = Array.isArray(whitelist) ? whitelist : [];
        lista.push({ nome: nome.trim(), equipe: equipe.trim() });
        await globalThis.SafeStorage.set(WHITELIST_KEY, lista);
    }

    return {
        validate,
        getEquipes,
        addOperador
    };
})();

}
