// FlowDesk MV3 — config.js
// Sprint 1.3 — Webhook URL fora do bundle + token de autenticação

/** @constant {Object} Defaults do webhook — URL lida em runtime via chrome.storage.local */
const WEBHOOK_DEFAULTS = { TOKEN: 'FLOWDESK_SER_2026' };

const CONFIG_APP = {
    STORAGE_DATA: 'hyper_bloco_data_v2',
    STORAGE_POS: 'hyper_bloco_pos',
    STORAGE_MACROS: 'hyper_bloco_macros_v2',
    STORAGE_AGENDA: 'hyper_bloco_agenda_v1',
    STORAGE_THEME: 'hyper_bloco_theme',
    STORAGE_PROPOSALS: 'flowdesk_proposals_v1',
    STORAGE_HOLIDAYS: 'flowdesk_holidays_cache',
    FIN_THEME: 'fin_painel_theme',
    MAX_TABS: 4,
    MAX_HISTORY: 30,
    MAX_PROPOSALS: 30,
    DOM_ID: {
        CONTAINER: 'bloco-notas',
        TEXT_AREA: 'area-texto',
        BTN_OPEN: 'btn-sd-note'
    }
};

/**
 * Feriados nacionais brasileiros fixos como fallback (formato MM-DD).
 * Usado quando o cache do Google Calendar não está disponível.
 * Não inclui carnaval (não é feriado nacional) nem datas regionais.
 */
const FERIADOS_NACIONAIS_FIXOS = [
    '01-01', // Confraternização Universal
    '04-21', // Tiradentes
    '05-01', // Dia do Trabalho
    '09-07', // Independência do Brasil
    '10-12', // Nossa Senhora Aparecida
    '11-02', // Finados
    '11-15', // Proclamação da República
    '11-20', // Consciência Negra
    '12-25'  // Natal
];

/**
 * Palavras-chave de feriados NÃO nacionais/regionais para filtrar.
 * Garante que apenas feriados federais sejam considerados.
 */
const HOLIDAY_BLACKLIST = [
    'carnaval', 'carnival', 'quarta-feira de cinzas', 'segunda-feira de carnaval',
    'terça-feira de carnaval', 'véspera de carnaval', 'corpus christi'
];

/**
 * Perfis padrão de funcionalidade por site caso o storage ainda não tenha sido populado.
 */
const DEFAULT_SITE_PROFILES = {
    'conversas.hyperflow.global': { enableFinModule: true, enableNotesModule: true,  enableMacroSuggester: true,  enableTelemetry: true  },
    'web.whatsapp.com':           { enableFinModule: true, enableNotesModule: true,  enableMacroSuggester: true,  enableTelemetry: false },
    'mail.google.com':            { enableFinModule: true, enableNotesModule: true,  enableMacroSuggester: true,  enableTelemetry: false }
};

let cachedResolvedProfile = null;

/**
 * Normaliza e busca a correspondência de um hostname dentro de uma tabela de perfis de site.
 * Suporta correspondência exata e por sufixo de domínio (ex: 'sereduc.com' cobre 'intranet.sereduc.com').
 * @param {string} hostname 
 * @param {Object} profiles 
 * @returns {Object|null}
 */
function matchSiteProfile(hostname, profiles) {
    if (!profiles || typeof profiles !== 'object') return null;
    const target = (hostname || '').toLowerCase().trim();
    if (!target) return null;

    // 1. Correspondência exata
    if (profiles[target]) {
        return { ...profiles[target], matchedDomain: target };
    }

    // 2. Correspondência por domínio base / subdomínio
    for (const [rawDomain, profile] of Object.entries(profiles)) {
        if (!rawDomain || rawDomain === 'default') continue;
        const cleanDomain = rawDomain.toLowerCase().replace(/^\*\./, '').trim();
        if (!cleanDomain) continue;

        if (target === cleanDomain || target.endsWith('.' + cleanDomain)) {
            return { ...profile, matchedDomain: cleanDomain };
        }
    }

    return null;
}

/**
 * Resolve de forma assíncrona o perfil de ativação do site atual consultando o chrome.storage.local.
 * Retorna null se o site não estiver ativado ou não estiver na lista de domínios permitidos.
 * @param {string} [hostname=location.hostname]
 * @returns {Promise<Object|null>}
 */
async function resolveSiteProfile(hostname = location.hostname) {
    try {
        const storageData = await chrome.storage.local.get('SITE_PROFILES');
        const profiles = storageData.SITE_PROFILES || DEFAULT_SITE_PROFILES;
        const matched = matchSiteProfile(hostname, profiles);
        cachedResolvedProfile = matched;
        return matched;
    } catch (err) {
        console.warn('[FlowDesk Config] Falha ao resolver perfil de site do storage, usando fallback:', err);
        const fallback = matchSiteProfile(hostname, DEFAULT_SITE_PROFILES);
        cachedResolvedProfile = fallback;
        return fallback;
    }
}

/**
 * Retorna o perfil de funcionalidade síncrono em cache ou padrão.
 * @returns {Object} Perfil com flags de módulos habilitados
 */
function getCurrentProfile() {
    if (cachedResolvedProfile) return cachedResolvedProfile;
    const fallback = matchSiteProfile(location.hostname, DEFAULT_SITE_PROFILES);
    return fallback || { enableFinModule: true, enableNotesModule: true, enableMacroSuggester: true, enableTelemetry: false };
}

globalThis.CONFIG_APP = CONFIG_APP;
globalThis.WEBHOOK_DEFAULTS = WEBHOOK_DEFAULTS;
globalThis.FERIADOS_NACIONAIS_FIXOS = FERIADOS_NACIONAIS_FIXOS;
globalThis.HOLIDAY_BLACKLIST = HOLIDAY_BLACKLIST;
globalThis.DEFAULT_SITE_PROFILES = DEFAULT_SITE_PROFILES;
globalThis.SITE_PROFILES = DEFAULT_SITE_PROFILES;
globalThis.matchSiteProfile = matchSiteProfile;
globalThis.resolveSiteProfile = resolveSiteProfile;
globalThis.getCurrentProfile = getCurrentProfile;
