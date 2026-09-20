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
 * Perfis de funcionalidade por site.
 * Cada hostname mapeia para um objeto de flags que controlam quais módulos são ativados.
 * O perfil 'default' é usado para sites não listados.
 */
const SITE_PROFILES = {
    'conversas.hyperflow.global': { enableFinModule: true, enableNotesModule: true,  enableMacroSuggester: true,  enableTelemetry: true  },
    'web.whatsapp.com':           { enableFinModule: true, enableNotesModule: true,  enableMacroSuggester: true,  enableTelemetry: false },
    'mail.google.com':            { enableFinModule: true, enableNotesModule: true,  enableMacroSuggester: true,  enableTelemetry: false },
    'default':                    { enableFinModule: true, enableNotesModule: true,  enableMacroSuggester: true,  enableTelemetry: false }
};

/**
 * Retorna o perfil de funcionalidade para o hostname atual.
 * @returns {Object} Perfil com flags de módulos habilitados
 */
function getCurrentProfile() {
    return SITE_PROFILES[location.hostname] || SITE_PROFILES['default'];
}

globalThis.CONFIG_APP = CONFIG_APP;
globalThis.WEBHOOK_DEFAULTS = WEBHOOK_DEFAULTS;
globalThis.FERIADOS_NACIONAIS_FIXOS = FERIADOS_NACIONAIS_FIXOS;
globalThis.HOLIDAY_BLACKLIST = HOLIDAY_BLACKLIST;
globalThis.SITE_PROFILES = SITE_PROFILES;
globalThis.getCurrentProfile = getCurrentProfile;
