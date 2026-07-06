/**
 * Shared Store layer for the global champion data aggregation system.
 *
 * Storage layout (Store mode - default):
 *   mayhemDoctorGlobal.stats -> packed aggregated champion stats
 *   mayhemDoctorGlobal.crawl -> resumable crawl state (queue, visited, processedGameIds)
 *
 * Storage layout (file cache mode — useFileGlobalCache setting):
 *   global stats are kept out of DataStore entirely. On startup they are fetched
 *   from https://plugins/Mayhem-Doctor/data/md-global-stats.json. After a crawl
 *   the user saves it via file picker. Store only holds the crawl state.
 */

import { readCacheIndex, readCacheEntry } from './cache.js';
import { toPatchLabel } from './ui/patchFilter.js';
import { STORE_KEYS, STORE_MODULES, storeGet, storeRemove, storeSet } from './store.js';
import {
    isFileCacheEnabled,
    readGlobalStatsFromFile,
    markGlobalStatsDirty,
} from './fileCache.js';

const STATS_VERSION = 1;
const CRAWL_VERSION = 1;

let _globalStatsCache = null;
let _rawGlobalStatsCache = null;
let _pendingCrawlState = null;

/**
 * Called from index.js after loadSettings() and initResolver().
 * Tries to load global stats from the plugin data file into the raw cache so
 * all subsequent synchronous reads hit memory, not Store.
 * No-op if useFileGlobalCache is disabled or the file does not exist yet.
 */
export async function initGlobalFileCache() {
    if (!isFileCacheEnabled()) return;
    const raw = await readGlobalStatsFromFile();
    if (raw) {
        _rawGlobalStatsCache = raw;
        _globalStatsCache    = null;
        // Store entry is kept intact. The explicit "Migrate" button will remove it.
        console.log('[MD-GlobalCache] File cache active — loaded md-global-stats from file');
    }
}

function getRawGlobalStats() {
    if (_rawGlobalStatsCache) return _rawGlobalStatsCache;

    // File cache mode: initGlobalFileCache() should have populated _rawGlobalStatsCache
    // at startup. If it didn't (file not found yet), return empty rather than
    // falling through to Store - the stats blob may not be there anyway.
    if (isFileCacheEnabled()) {
        _rawGlobalStatsCache = { v: STATS_VERSION, savedAt: Date.now(), patch: null, totalGames: 0, visitedCount: 0, seenPatches: [], champions: {} };
        return _rawGlobalStatsCache;
    }

    try {
        const raw = storeGet(STORE_MODULES.global, STORE_KEYS.globalStats);
        if (raw) {
            _rawGlobalStatsCache = raw;
        } else {
            _rawGlobalStatsCache = { v: STATS_VERSION, savedAt: Date.now(), patch: null, totalGames: 0, visitedCount: 0, seenPatches: [], champions: {} };
        }
    } catch (e) {
        console.error('[MD-GlobalCache] getRawGlobalStats failed:', e);
        _rawGlobalStatsCache = { v: STATS_VERSION, savedAt: Date.now(), patch: null, totalGames: 0, visitedCount: 0, seenPatches: [], champions: {} };
    }
    return _rawGlobalStatsCache;
}

function packChampStats(s) {
    return [s.games, s.wins, s.kills, s.deaths, s.assists, s.dmg];
}

function packGameRecord(g) {
    // [0]=win [1]=items [2]=augments [3]=orderedBuild [4]=gameCreation (optional, absent in legacy records)
    const rec = [g.win ? 1 : 0, g.items, g.augments, g.orderedBuild];
    if (g.gameCreation != null) rec.push(g.gameCreation);
    return rec;
}

function unpackChampEntry(champId, entry) {
    const cKey = String(champId);
    const s = entry.s || [0, 0, 0, 0, 0, 0];
    const stats = {
        games: s[0],
        wins: s[1],
        kills: s[2],
        deaths: s[3],
        assists: s[4],
        dmg: s[5],
    };

    const champGames = [];
    const champItemStats = {};
    const champAugStats = {};

    const records = entry.g || [];
    for (const rec of records) {
        const win = rec[0] === 1;
        const items = rec[1] || [];
        const augments = rec[2] || [];
        const orderedBuild = rec[3] || [];
        // rec[4] = gameCreation timestamp — present in records written after this change,
        // null for legacy records. Consumers must treat null as unknown, not as a duplicate key.
        const gameCreation = rec[4] ?? null;

        champGames.push({ win, items, augments, orderedBuild, gameCreation });

        items.forEach(iId => {
            if (!champItemStats[iId]) champItemStats[iId] = { games: 0, wins: 0 };
            champItemStats[iId].games++;
            if (win) champItemStats[iId].wins++;
        });

        augments.forEach(aId => {
            if (!champAugStats[aId]) champAugStats[aId] = { games: 0, wins: 0 };
            champAugStats[aId].games++;
            if (win) champAugStats[aId].wins++;
        });
    }

    return { cKey, stats, champGames, champItemStats, champAugStats };
}

export function readGlobalStats() {
    if (_globalStatsCache) return _globalStatsCache;

    try {
        const raw = getRawGlobalStats();
        if (!raw || raw.totalGames === 0) return null;

        const stats = { wins: 0, losses: 0, remakes: 0, champions: {}, items: {}, augments: {} };
        const champGames = {};
        const champItemStats = {};
        const champAugStats = {};

        const champMap = raw.champions || {};
        for (const [champId, entry] of Object.entries(champMap)) {
            const u = unpackChampEntry(champId, entry);
            stats.champions[champId] = u.stats;
            stats.wins += u.stats.wins;
            stats.losses += (u.stats.games - u.stats.wins);
            champGames[u.cKey] = u.champGames;
            champItemStats[u.cKey] = u.champItemStats;
            champAugStats[u.cKey] = u.champAugStats;

            for (const [iId, d] of Object.entries(u.champItemStats)) {
                if (!stats.items[iId]) stats.items[iId] = { games: 0, wins: 0 };
                stats.items[iId].games += d.games;
                stats.items[iId].wins  += d.wins;
            }
            for (const [aId, d] of Object.entries(u.champAugStats)) {
                if (!stats.augments[aId]) stats.augments[aId] = { games: 0, wins: 0 };
                stats.augments[aId].games += d.games;
                stats.augments[aId].wins  += d.wins;
            }
        }

        _globalStatsCache = { stats, champGames, champItemStats, champAugStats, meta: { patch: raw.patch || null, totalGames: raw.totalGames || 0, visitedCount: raw.visitedCount || 0, savedAt: raw.savedAt || null, seenPatches: raw.seenPatches || [] } };
        
        // Raw cache is no longer needed in Store mode - the unpacked form is in _globalStatsCache
        // and the data is on disk. Releasing it here prevents both caches coexisting.
        // HOWEVER, in File Cache mode, the raw cache is our ONLY in-memory representation
        // to write back to the disk file! If we destroy it, saving will write an empty object.
        if (!isFileCacheEnabled()) {
            _rawGlobalStatsCache = null;
        }
        
        return _globalStatsCache;
    } catch (e) {
        console.error('[MD-GlobalCache] readGlobalStats failed:', e);
        return null;
    }
}

export function saveGlobalStats(data) {
    _globalStatsCache = null;
    try {
        const existing = getRawGlobalStats() || {};
        const packed = {
            v: STATS_VERSION,
            savedAt: Date.now(),
            patch: data.patch || existing.patch || null,
            totalGames: data.totalGames || existing.totalGames || 0,
            visitedCount: data.visitedCount || existing.visitedCount || 0,
            seenPatches: data.seenPatches || existing.seenPatches || [],
            champions: {},
        };
        if (existing.crawl) {
            packed.crawl = existing.crawl;
        }

        for (const [champId, entry] of Object.entries(data.champions)) {
            const existingG = (existing.champions && existing.champions[champId] && existing.champions[champId].g) || [];
            const newPacked = (entry.g || []).map(packGameRecord);
            
            const combinedG = [];
            for (let i = 0; i < existingG.length; i++) combinedG.push(existingG[i]);
            for (let i = 0; i < newPacked.length; i++) combinedG.push(newPacked[i]);
            
            packed.champions[champId] = {
                s: packChampStats(entry.s),
                g: combinedG,
            };
        }

        if (existing.champions) {
            for (const [champId, entry] of Object.entries(existing.champions)) {
                if (packed.champions[champId]) continue;
                packed.champions[champId] = { s: entry.s, g: entry.g || [] };
            }
        }

        _rawGlobalStatsCache = packed;
        if (isFileCacheEnabled()) {
            markGlobalStatsDirty();
        } else {
            storeSet(STORE_MODULES.global, STORE_KEYS.globalStats, packed);
        }
    } catch (e) {
        console.error('[MD-GlobalCache] saveGlobalStats failed:', e);
    }
}

export function clearGlobalStats() {
    _globalStatsCache    = null;
    if (isFileCacheEnabled() && _rawGlobalStatsCache) {
        _rawGlobalStatsCache = { v: STATS_VERSION, savedAt: Date.now(), patch: null, totalGames: 0, visitedCount: 0, seenPatches: [], champions: {}, crawl: _rawGlobalStatsCache.crawl };
        markGlobalStatsDirty();
    } else {
        _rawGlobalStatsCache = null;
    }
    try {
        storeRemove(STORE_MODULES.global, STORE_KEYS.globalStats);
    } catch {}
}

export function clearGlobalStatsCache() {
    _globalStatsCache = null;
}

export function readCrawlState() {
    if (isFileCacheEnabled()) {
        const raw = getRawGlobalStats();
        if (!raw || !raw.crawl || (raw.crawl.v || 0) < CRAWL_VERSION) return null;
        return {
            patch: raw.crawl.patch || null,
            queue: raw.crawl.queue || [],
            visited: new Set(raw.crawl.visited || []),
            processedGameIds: new Set(raw.crawl.processedGameIds || []),
            totalGames: raw.crawl.totalGames || 0,
            seenPatches: raw.crawl.seenPatches || [],
            startedAt: raw.crawl.startedAt || Date.now(),
        };
    }

    try {
        const raw = storeGet(STORE_MODULES.global, STORE_KEYS.globalCrawl);
        if (!raw || (raw.v || 0) < CRAWL_VERSION) return null;
        return {
            patch: raw.patch || null,
            queue: raw.queue || [],
            visited: new Set(raw.visited || []),
            processedGameIds: new Set(raw.processedGameIds || []),
            totalGames: raw.totalGames || 0,
            seenPatches: raw.seenPatches || [],
            startedAt: raw.startedAt || Date.now(),
        };
    } catch {
        return null;
    }
}

export function saveCrawlState(state) {
    const packed = {
        v: CRAWL_VERSION,
        patch: state.patch || null,
        queue: state.queue,
        visited: [...state.visited],
        processedGameIds: [...state.processedGameIds],
        totalGames: state.totalGames,
        seenPatches: state.seenPatches ? [...state.seenPatches] : [],
        startedAt: state.startedAt,
    };

    // Both modes: keep crawl state in memory only during the crawl.
    // Store writes trigger a full DataStore JSON.stringify + XOR + file write
    // on every call — even if our data is small, other plugins' data in the
    // store makes this expensive.  We defer the single DataStore commit to
    // commitCrawlState(), called once at crawl end.
    _pendingCrawlState = packed;

    if (isFileCacheEnabled()) {
        const raw = getRawGlobalStats();
        if (raw) {
            raw.crawl = packed;
        }
    }
}

/**
 * Flush the in-memory crawl state to persistent storage (Store or file).
 * Called once at crawl end — keeps the expensive serialisation to a single commit.
 */
export function commitCrawlState() {
    if (!_pendingCrawlState) return;

    if (isFileCacheEnabled()) {
        // Already embedded in _rawGlobalStatsCache.crawl by saveCrawlState().
        // markGlobalStatsDirty() is handled by writeFinalCrawlStats() which
        // is always called alongside commitCrawlState().
    } else {
        try {
            storeSet(STORE_MODULES.global, STORE_KEYS.globalCrawl, _pendingCrawlState);
        } catch (e) {
            console.error('[MD-GlobalCache] commitCrawlState failed:', e);
        }
    }
    _pendingCrawlState = null;
}

export function clearCrawlState() {
    if (isFileCacheEnabled()) {
        const raw = getRawGlobalStats();
        if (raw && raw.crawl) {
            delete raw.crawl;
            markGlobalStatsDirty();
        }
    } else {
        try { storeRemove(STORE_MODULES.global, STORE_KEYS.globalCrawl); } catch {}
    }
}

export function clearAllGlobalData() {
    const hadStats = storeGet(STORE_MODULES.global, STORE_KEYS.globalStats) != null;
    clearGlobalStats();
    clearCrawlState();
    return hadStats;
}

export function readRawGlobalStats() {
    return getRawGlobalStats();
}

/**
 * Repair persisted global stats totals using the resumable crawl state.
 * This corrects inflated `totalGames` / `visitedCount` values by taking the
 * authoritative counts from the crawl state (`md-global-crawl`).
 *
 * Returns a summary object { before: { totalGames, visitedCount }, after: { ... } }
 */
export function repairGlobalStatsFromCrawl() {
    try {
        const raw = getRawGlobalStats();
        const crawl = (function() {
            try { return storeGet(STORE_MODULES.global, STORE_KEYS.globalCrawl); } catch { return null; }
        })();

        const before = { totalGames: raw.totalGames || 0, visitedCount: raw.visitedCount || 0 };

        if (!crawl) {
            return { ok: false, error: 'No crawl state found (md-global-crawl).' , before };
        }

        // crawl.processedGameIds may be an array of timestamps; prefer crawl.totalGames if present
        const correctedTotal = typeof crawl.totalGames === 'number' ? crawl.totalGames : (Array.isArray(crawl.processedGameIds) ? crawl.processedGameIds.length : (crawl.processedGameIds ? (typeof crawl.processedGameIds.size === 'number' ? crawl.processedGameIds.size : 0) : 0));
        const correctedVisited = Array.isArray(crawl.visited) ? crawl.visited.length : (crawl.visited ? (typeof crawl.visited.length === 'number' ? crawl.visited.length : (typeof crawl.visited.size === 'number' ? crawl.visited.size : 0)) : 0);

        raw.totalGames   = correctedTotal;
        raw.visitedCount = correctedVisited;
        raw.savedAt      = Date.now();

        if (isFileCacheEnabled()) {
            _globalStatsCache    = null;
            _rawGlobalStatsCache = raw;
            markGlobalStatsDirty();
        } else {
            try { storeSet(STORE_MODULES.global, STORE_KEYS.globalStats, raw); } catch (e) { return { ok: false, error: e.message, before }; }
            _globalStatsCache    = null;
            _rawGlobalStatsCache = raw;
        }

        return { ok: true, before, after: { totalGames: raw.totalGames, visitedCount: raw.visitedCount } };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// Expose a quick repair helper on window for convenience in DevTools.
try { if (typeof window !== 'undefined') window.__mdRepairGlobalStatsFromCrawl = repairGlobalStatsFromCrawl; } catch (e) {}

/**
 * Remove all g[] game records from the persisted stats, keeping s[] intact.
 * Returns a map { champId: g[] } of the stripped records so the caller can
 * hold them in memory and write them back at the end of a crawl.
 * This keeps the Store payload small during crawling, preventing the repeated
 * 20-60 MB JSON serialisation cycles that cause V8 heap fragmentation.
 */
export function stripGameRecordsFromStore() {
    try {
        const raw = getRawGlobalStats();
        const stripped = {};
        for (const [champId, entry] of Object.entries(raw.champions || {})) {
            if (entry.g && entry.g.length > 0) {
                stripped[champId] = entry.g;
                entry.g = [];
            }
        }
        raw.savedAt = Date.now();
        // In-memory only - no Store write here.  writeFinalCrawlStats()
        // replaces the entire blob at crawl end in a single commit.
        _rawGlobalStatsCache = raw;
        return stripped;
    } catch (e) {
        console.error('[MD-GlobalCache] stripGameRecordsFromStore failed:', e);
        return {};
    }
}

/**
 * Write the complete final crawl results to Store in a single operation.
 * Called once at crawl end with the full accumulator (s[] stats) and game
 * buffer (g[] records).  This completely replaces the md-global-stats blob.
 *
 * @param {Object} opts
 * @param {Object} opts.champions  - { champId: { s: {games,wins,kills,deaths,assists,dmg}, g:[] } }
 * @param {Object} opts.gameRecords - { champId: [ [win,items,augs,build,gameCreation], ... ] }
 * @param {string} opts.patch
 * @param {number} opts.totalGames
 * @param {number} opts.visitedCount
 */
export function writeFinalCrawlStats({ champions, gameRecords, patch, totalGames, visitedCount, seenPatches }) {
    try {
        const existing = getRawGlobalStats() || {};
        const packed = {
            v: STATS_VERSION,
            savedAt: Date.now(),
            patch: patch || null,
            totalGames: totalGames || 0,
            visitedCount: visitedCount || 0,
            seenPatches: seenPatches ? [...seenPatches] : (existing.seenPatches || []),
            champions: {},
        };
        if (existing.crawl) {
            packed.crawl = existing.crawl;
        }

        const allChampIds = new Set([
            ...Object.keys(champions || {}),
            ...Object.keys(gameRecords || {}),
        ]);

        for (const champId of allChampIds) {
            const champData = (champions || {})[champId];
            const s = champData && champData.s
                ? packChampStats(champData.s)
                : [0, 0, 0, 0, 0, 0];
            const g = (gameRecords || {})[champId] || [];
            packed.champions[champId] = { s, g };
        }

        if (isFileCacheEnabled()) {
            _rawGlobalStatsCache = packed;
            _globalStatsCache    = null;
            markGlobalStatsDirty();
        } else {
            storeSet(STORE_MODULES.global, STORE_KEYS.globalStats, packed);
            _globalStatsCache    = null;
            _rawGlobalStatsCache = null;
        }
    } catch (e) {
        console.error('[MD-GlobalCache] writeFinalCrawlStats failed:', e);
    }
}

export function getAvailablePatchesFromCache() {
    try {
        const idx = readCacheIndex();
        const patchSet = new Set();
        for (const puuid of idx.puuids) {
            const entry = readCacheEntry(puuid);
            if (!entry) continue;
            for (const h of entry.history) {
                const label = toPatchLabel(h.gameVersion || '');
                if (label && label !== 'Unknown') patchSet.add(label);
            }
        }
        
        const raw = getRawGlobalStats();
        if (raw) {
            if (raw.seenPatches) {
                raw.seenPatches.forEach(p => patchSet.add(p));
            }
            if (raw.crawl && raw.crawl.seenPatches) {
                raw.crawl.seenPatches.forEach(p => patchSet.add(p));
            }
        }
        
        return [...patchSet].sort((a, b) => {
            const [aMaj, aMin] = a.split('.').map(Number);
            const [bMaj, bMin] = b.split('.').map(Number);
            return bMaj !== aMaj ? bMaj - aMaj : bMin - aMin;
        });
    } catch {
        return [];
    }
}

export async function reloadCacheMode(fileModeEnabled) {
    _globalStatsCache = null;
    _rawGlobalStatsCache = null;
    if (fileModeEnabled) {
        await initGlobalFileCache();
    }
}
