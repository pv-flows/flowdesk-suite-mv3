// FlowDesk MV3 — storage.js
// Etapa 1 (v5.2.7) — SafeStorage resiliente + metadados de sincronização (fd_sync_meta)

if (!globalThis.SafeStorage) {

const SYNC_TRACKED_KEYS = new Set([
    'hyper_bloco_data_v2',
    'hyper_bloco_macros_v2',
    'hyper_bloco_agenda_v1',
    'flowdesk_proposals_v1',
    'fd_proposal_template',
    'fd_panel_sections',
    'SITE_PROFILES'
]);

/**
 * Wrapper seguro para chrome.storage.local com serialização JSON resiliente.
 * Suporta tanto valores serializados com JSON.stringify quanto strings/objetos nativos.
 */
const get = async (key, defaultVal) => {
    try {
        const result = await chrome.storage.local.get(key);
        const val = result[key];
        if (val === undefined || val === null) return defaultVal;
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                return parsed === null ? defaultVal : parsed;
            } catch (_) {
                // Valor salvo como string literal direta (ex: em options page antiga)
                return val;
            }
        }
        return val;
    } catch (e) {
        return defaultVal;
    }
};

const set = async (key, val) => {
    try {
        const payload = { [key]: JSON.stringify(val) };
        if (SYNC_TRACKED_KEYS.has(key)) {
            const metaResult = await chrome.storage.local.get('fd_sync_meta');
            const meta = metaResult.fd_sync_meta || {};
            meta[key] = { updatedAt: Date.now(), dirty: true };
            payload.fd_sync_meta = meta;
        }
        await chrome.storage.local.set(payload);
    } catch (e) {
        console.error('[FlowDesk SafeStorage] Erro ao gravar:', e);
    }
};

globalThis.SafeStorage = { get, set };

}
