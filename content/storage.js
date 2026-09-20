// FlowDesk MV3 — storage.js

if (!globalThis.SafeStorage) {

/**
 * Wrapper seguro para chrome.storage.local com serialização JSON.
 * Substitui GM_getValue/GM_setValue do userscript original.
 */
const get = async (key, defaultVal) => {
    try {
        const result = await chrome.storage.local.get(key);
        const val = result[key];
        if (val === undefined || val === null) return defaultVal;
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        return parsed === null ? defaultVal : parsed;
    } catch (e) {
        return defaultVal;
    }
};

const set = async (key, val) => {
    try {
        await chrome.storage.local.set({ [key]: JSON.stringify(val) });
    } catch (e) {
        console.error(e);
    }
};

globalThis.SafeStorage = { get, set };

}
