/**
 * File-based cache layer — bypasses DataStore for large blobs.
 *
 * WHY: Pengu's DataStore.set() always calls commit(), which JSON.stringify's
 * the entire store, XOR's it, and writes it to disk. With a 50-70 MB global
 * stats blob in the store, every write — including unrelated Snooze-CSS profile
 * switches — triggers that full cycle, causing visible lag.
 *
 * HOW: When useFileGlobalCache is enabled, md-global-stats is kept out of
 * DataStore entirely. On startup it is fetched from the plugin's served URL
 * (https://plugins/Mayhem-Doctor/data/md-global-stats.json). After a crawl
 * completes the user saves it via showSaveFilePicker — they must save to the
 * plugin's data/ directory so it is available for the next fetch on startup.
 *
 * Everything else (crawl state, personal cache, settings) stays in DataStore —
 * only the large blob is moved out.
 *
 * The resolver must be initialized before readGlobalStatsFromFile is called.
 */

import { resolveRelativePath } from './resolver.js';

const GLOBAL_STATS_FILE = './data/md-global-stats.json';

// Set once from index.js after loadSettings() — avoids importing settings here
// which would create a dependency on the UI layer.
let _enabled = false;
let _dirty   = false;

export function setFileCacheEnabled(enabled) {
    _enabled = !!enabled;
}

export function isFileCacheEnabled() {
    return _enabled;
}

export function markGlobalStatsDirty() {
    _dirty = true;
}

export function isGlobalStatsDirty() {
    return _dirty;
}

export function clearGlobalStatsDirty() {
    _dirty = false;
}

/**
 * Fetch global stats from the plugin's served data directory.
 * Returns the raw parsed object or null if not found / resolver not ready.
 * cache: 'no-store' prevents the browser from serving a stale cached response.
 */
export async function readGlobalStatsFromFile() {
    const url = resolveRelativePath(GLOBAL_STATS_FILE);
    if (!url) {
        console.warn('[MD-FileCache] Resolver not initialized — cannot read from file');
        return null;
    }
    try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) return null;
        const data = await resp.json();
        console.log(`[MD-FileCache] Loaded global stats from file (${url})`);
        return data;
    } catch (e) {
        console.warn('[MD-FileCache] readGlobalStatsFromFile failed:', e.message);
        return null;
    }
}

/**
 * Save raw global stats JSON via showSaveFilePicker.
 * User should save to: <Pengu plugins dir>/Mayhem-Doctor/data/md-global-stats.json
 * so it is automatically fetched on next startup.
 *
 * Returns true on success, false if user cancelled.
 */
export async function saveGlobalStatsToFile(rawData) {
    const json     = JSON.stringify(rawData);
    const blob     = new Blob([json], { type: 'application/json' });
    const filename = 'md-global-stats.json';

    if (typeof window.showSaveFilePicker === 'function') {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: 'Mayhem Doctor Cache', accept: { 'application/json': ['.json'] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            _dirty = false;
            return true;
        } catch (e) {
            if (e.name === 'AbortError') return false;
            console.warn('[MD-FileCache] showSaveFilePicker failed (likely CEF context restriction), trying fallback:', e);
            // Fall through to the anchor tag download
        }
    }

    // Fallback: anchor download
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    _dirty = false;
    return true;
}

/**
 * Returns the absolute URL where the plugin expects to find the cache file.
 * Shown in the UI so the user knows where to save it.
 */
export function getExpectedFilePath() {
    return resolveRelativePath(GLOBAL_STATS_FILE) || GLOBAL_STATS_FILE;
}
