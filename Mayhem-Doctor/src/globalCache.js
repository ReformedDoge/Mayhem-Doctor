import { readCacheIndex, readCacheEntry } from './cache.js';
import { toPatchLabel } from './ui/patchFilter.js';
import { STORE_KEYS, STORE_MODULES, storeGet, storeRemove, storeSet } from './store.js';
import {
    isFileCacheEnabled,
    readGlobalStatsFromFile,
    markGlobalStatsDirty,
} from './fileCache.js';
import { Mode, getCacheStoreModule, getGlobalStoreModule } from './mode.js';
import Utils from './generalUtils.js';

const STATS_VERSION = 1;
const CRAWL_VERSION = 1;

const _globalStatsCache = {};
const _rawGlobalStatsCache = {};
const _pendingCrawlState = {};

function getGlobalMod(mode) {
    return getGlobalStoreModule(mode);
}

/**
 * Called from index.js after loadSettings() and initResolver().
 */
export async function initGlobalFileCache(mode = Mode.OFFICIAL) {
    if (!isFileCacheEnabled()) return;
    const raw = await readGlobalStatsFromFile(mode);
    if (raw) {
        _rawGlobalStatsCache[mode] = raw;
        _globalStatsCache[mode] = null;
        Utils.Debug.log(`[MD-GlobalCache] File cache active - loaded ${mode} global stats from file`);
    }
}

function getRawGlobalStats(mode) {
    if (_rawGlobalStatsCache[mode]) return _rawGlobalStatsCache[mode];

    if (isFileCacheEnabled()) {
        _rawGlobalStatsCache[mode] = { v: STATS_VERSION, savedAt: Date.now(), patch: null, totalGames: 0, visitedCount: 0, seenPatches: [], champions: {} };
        return _rawGlobalStatsCache[mode];
    }

    try {
        const raw = storeGet(getGlobalMod(mode), STORE_KEYS.globalStats);
        if (raw) {
            _rawGlobalStatsCache[mode] = raw;
        } else {
            _rawGlobalStatsCache[mode] = { v: STATS_VERSION, savedAt: Date.now(), patch: null, totalGames: 0, visitedCount: 0, seenPatches: [], champions: {} };
        }
    } catch (e) {
        Utils.Debug.error('[MD-GlobalCache] getRawGlobalStats failed:', e);
        _rawGlobalStatsCache[mode] = { v: STATS_VERSION, savedAt: Date.now(), patch: null, totalGames: 0, visitedCount: 0, seenPatches: [], champions: {} };
    }
    return _rawGlobalStatsCache[mode];
}

function packChampStats(s) {
    return [s.games, s.wins, s.kills, s.deaths, s.assists, s.dmg];
}

function packGameRecord(g) {
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

export function readGlobalStats(mode = Mode.OFFICIAL) {
    if (_globalStatsCache[mode]) return _globalStatsCache[mode];

    try {
        const raw = getRawGlobalStats(mode);
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

        _globalStatsCache[mode] = { stats, champGames, champItemStats, champAugStats, meta: { patch: raw.patch || null, totalGames: raw.totalGames || 0, visitedCount: raw.visitedCount || 0, savedAt: raw.savedAt || null, seenPatches: raw.seenPatches || [] } };

        if (!isFileCacheEnabled()) {
            _rawGlobalStatsCache[mode] = null;
        }

        return _globalStatsCache[mode];
    } catch (e) {
        Utils.Debug.error('[MD-GlobalCache] readGlobalStats failed:', e);
        return null;
    }
}

export function saveGlobalStats(data, mode = Mode.OFFICIAL) {
    _globalStatsCache[mode] = null;
    try {
        const existing = getRawGlobalStats(mode) || {};
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

        _rawGlobalStatsCache[mode] = packed;
        if (isFileCacheEnabled()) {
            markGlobalStatsDirty();
        } else {
            storeSet(getGlobalMod(mode), STORE_KEYS.globalStats, packed);
        }
    } catch (e) {
        Utils.Debug.error('[MD-GlobalCache] saveGlobalStats failed:', e);
    }
}

export function clearGlobalStats(mode = Mode.OFFICIAL) {
    _globalStatsCache[mode] = null;
    if (isFileCacheEnabled() && _rawGlobalStatsCache[mode]) {
        _rawGlobalStatsCache[mode] = { v: STATS_VERSION, savedAt: Date.now(), patch: null, totalGames: 0, visitedCount: 0, seenPatches: [], champions: {}, crawl: _rawGlobalStatsCache[mode].crawl };
        markGlobalStatsDirty();
    } else {
        _rawGlobalStatsCache[mode] = null;
    }
    try {
        storeRemove(getGlobalMod(mode), STORE_KEYS.globalStats);
    } catch {}
}

export function clearGlobalStatsCache(mode = Mode.OFFICIAL) {
    _globalStatsCache[mode] = null;
}

export function readCrawlState(mode = Mode.OFFICIAL) {
    if (isFileCacheEnabled()) {
        const raw = getRawGlobalStats(mode);
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
        const raw = storeGet(getGlobalMod(mode), STORE_KEYS.globalCrawl);
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

export function saveCrawlState(state, mode = Mode.OFFICIAL) {
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

    _pendingCrawlState[mode] = packed;

    if (isFileCacheEnabled()) {
        const raw = getRawGlobalStats(mode);
        if (raw) {
            raw.crawl = packed;
        }
    }
}

export function commitCrawlState(mode = Mode.OFFICIAL) {
    if (!_pendingCrawlState[mode]) return;

    if (isFileCacheEnabled()) {
    } else {
        try {
            storeSet(getGlobalMod(mode), STORE_KEYS.globalCrawl, _pendingCrawlState[mode]);
        } catch (e) {
            Utils.Debug.error('[MD-GlobalCache] commitCrawlState failed:', e);
        }
    }
    _pendingCrawlState[mode] = null;
}

export function clearCrawlState(mode = Mode.OFFICIAL) {
    if (isFileCacheEnabled()) {
        const raw = getRawGlobalStats(mode);
        if (raw && raw.crawl) {
            delete raw.crawl;
            markGlobalStatsDirty();
        }
    } else {
        try { storeRemove(getGlobalMod(mode), STORE_KEYS.globalCrawl); } catch {}
    }
}

export function clearAllGlobalData(mode = Mode.OFFICIAL) {
    const hadStats = storeGet(getGlobalMod(mode), STORE_KEYS.globalStats) != null;
    clearGlobalStats(mode);
    clearCrawlState(mode);
    return hadStats;
}

export function readRawGlobalStats(mode = Mode.OFFICIAL) {
    return getRawGlobalStats(mode);
}

export function repairGlobalStatsFromCrawl(mode = Mode.OFFICIAL) {
    try {
        const raw = getRawGlobalStats(mode);
        const crawl = (function() {
            try { return storeGet(getGlobalMod(mode), STORE_KEYS.globalCrawl); } catch { return null; }
        })();

        const before = { totalGames: raw.totalGames || 0, visitedCount: raw.visitedCount || 0 };

        if (!crawl) {
            return { ok: false, error: 'No crawl state found.', before };
        }

        const correctedTotal = typeof crawl.totalGames === 'number' ? crawl.totalGames : (Array.isArray(crawl.processedGameIds) ? crawl.processedGameIds.length : (crawl.processedGameIds ? (typeof crawl.processedGameIds.size === 'number' ? crawl.processedGameIds.size : 0) : 0));
        const correctedVisited = Array.isArray(crawl.visited) ? crawl.visited.length : (crawl.visited ? (typeof crawl.visited.length === 'number' ? crawl.visited.length : (typeof crawl.visited.size === 'number' ? crawl.visited.size : 0)) : 0);

        raw.totalGames   = correctedTotal;
        raw.visitedCount = correctedVisited;
        raw.savedAt      = Date.now();

        if (isFileCacheEnabled()) {
            _globalStatsCache[mode] = null;
            _rawGlobalStatsCache[mode] = raw;
            markGlobalStatsDirty();
        } else {
            try { storeSet(getGlobalMod(mode), STORE_KEYS.globalStats, raw); } catch (e) { return { ok: false, error: e.message, before }; }
            _globalStatsCache[mode] = null;
            _rawGlobalStatsCache[mode] = raw;
        }

        return { ok: true, before, after: { totalGames: raw.totalGames, visitedCount: raw.visitedCount } };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

try { if (typeof window !== 'undefined') window.__mdRepairGlobalStatsFromCrawl = repairGlobalStatsFromCrawl; } catch (e) {}

export function stripGameRecordsFromStore(mode = Mode.OFFICIAL) {
    try {
        const raw = getRawGlobalStats(mode);
        const stripped = {};
        for (const [champId, entry] of Object.entries(raw.champions || {})) {
            if (entry.g && entry.g.length > 0) {
                stripped[champId] = entry.g;
                entry.g = [];
            }
        }
        raw.savedAt = Date.now();
        _rawGlobalStatsCache[mode] = raw;
        return stripped;
    } catch (e) {
        Utils.Debug.error('[MD-GlobalCache] stripGameRecordsFromStore failed:', e);
        return {};
    }
}

export function writeFinalCrawlStats({ champions, gameRecords, patch, totalGames, visitedCount, seenPatches }, mode = Mode.OFFICIAL) {
    try {
        const existing = getRawGlobalStats(mode) || {};
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
            _rawGlobalStatsCache[mode] = packed;
            _globalStatsCache[mode] = null;
            markGlobalStatsDirty();
        } else {
            storeSet(getGlobalMod(mode), STORE_KEYS.globalStats, packed);
            _globalStatsCache[mode] = null;
            _rawGlobalStatsCache[mode] = null;
        }
    } catch (e) {
        Utils.Debug.error('[MD-GlobalCache] writeFinalCrawlStats failed:', e);
    }
}

export function getAvailablePatchesFromCache(mode = Mode.OFFICIAL) {
    try {
        const idx = readCacheIndex(mode);
        const patchSet = new Set();
        for (const puuid of idx.puuids) {
            const entry = readCacheEntry(puuid, mode);
            if (!entry) continue;
            for (const h of entry.history) {
                const label = toPatchLabel(h.gameVersion || '');
                if (label && label !== 'Unknown') patchSet.add(label);
            }
        }

        const raw = getRawGlobalStats(mode);
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

export async function reloadCacheMode(fileModeEnabled, mode = Mode.OFFICIAL) {
    _globalStatsCache[mode] = null;
    _rawGlobalStatsCache[mode] = null;
    if (fileModeEnabled) {
        await initGlobalFileCache(mode);
    }
}