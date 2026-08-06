import { Mode, getValidQueueIds, getQueueId } from '../mode.js';
import Utils from '../generalUtils.js';

/**
 * Global champion data crawl engine.
 *
 * Performs a controlled BFS over the ARAM/Mayhem player network, collecting
 * unique games and accumulating champion-level statistics.
 *
 * Entry points:
 *   startCrawl(myPuuid, sgpServer, rsoToken, targetPatch, onProgress)
 *   cancelCrawl()
 *   isCrawlRunning()
 *
 * onProgress is called with:
 *   { phase, totalGames, visitedPlayers, queueSize, message, error? }
 *   phase: 'running' | 'done' | 'cancelled' | 'error'
 */

import {
    VALID_QUEUE_IDS,
    BLACKLIST_ITEM_IDS,
    CRAWL_BATCH_SIZE,
    BOOT_IDS,
    PROCESSED_GAME_IDS_MAX,
} from '../config.js';
import { getSettings } from './settings.js';
import { deriveOrderedBuild, smoothedWinRate } from '../analysis.js';
import {
    readCrawlState,
    saveCrawlState,
    commitCrawlState,
    clearCrawlState,
    readGlobalStats,
    clearGlobalStatsCache,
    stripGameRecordsFromStore,
    writeFinalCrawlStats,
} from '../globalCache.js';
import { toPatchLabel } from './patchFilter.js';
import { readCacheIndex } from '../cache.js';

// Game buffer - holds g[] packed game records in memory for the entire crawl.
// Written to DataStore in a single operation at crawl end together with the
// accumulator's s[] stats.  Zero writes to md-global-stats during the crawl;
// saveCrawlState() keeps crawl state in memory only - commitCrawlState()
// flushes it once at crawl end alongside the stats write.
// This eliminates the repeated 20-60 MB JSON serialisation cycles that caused
// 3.5 GB V8 heap fragmentation.

let _gameBuffer = {};
let _gameBufferCount = 0;

function _bufferGameRecord(champId, packedRec) {
    if (!_gameBuffer[champId]) _gameBuffer[champId] = [];
    _gameBuffer[champId].push(packedRec);
    _gameBufferCount++;
}

/**
 * Persist final crawl results: build complete stats from the in-memory
 * accumulator (s[]) and game buffer (g[]), write to DataStore once.
 */
function _persistFinalStats(accum, patch, mode = Mode.OFFICIAL) {
    try {
        writeFinalCrawlStats({
            champions: accum.champions,
            gameRecords: _gameBuffer,
            patch,
            totalGames: accum.totalGames,
            visitedCount: accum.visited ? accum.visited.size : 0,
            seenPatches: accum.seenPatches,
        }, mode);
    } catch (e) {
        Utils.Debug.error('[MD-Crawler] _persistFinalStats failed:', e);
    } finally {
        _gameBuffer = {};
        _gameBufferCount = 0;
    }
}

// Module-level state

let _running    = false;
let _cancelFlag = false;

export function isCrawlRunning() { return _running; }
export function cancelCrawl() {
    _cancelFlag = true;
}

// Helpers

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// RSO tokens are rotated by the client
// Refresh before that can happen and on 401 (guard).
const TOKEN_REFRESH_MS = 4 * 60 * 1000;

async function refreshToken(tokenRef, force = false) {
    if (!force && Date.now() - tokenRef.fetchedAt < TOKEN_REFRESH_MS) return false;
    try {
        const { getSgpContext } = await import('../lcu.js');
        const ctx = await getSgpContext();
        if (ctx?.rso?.token) {
            tokenRef.value = ctx.rso.token;
            tokenRef.fetchedAt = Date.now();
            Utils.Debug.log('[MD-Crawler] SGP token refreshed');
            return true;
        }
    } catch (e) {
        Utils.Debug.error('[MD-Crawler] SGP token refresh failed:', e);
    }
    return false;
}

/** Fisher-Yates shuffle (in-place, returns array) */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Fetches one batch of games for a PUUID directly from the SGP endpoint.
 * Does NOT use the per-player cache - we want raw game data for all participants.
 * Returns an array of raw game objects (g.json populated).
 */
async function fetchRawBatch(puuid, sgpServer, tokenRef, startIndex, mode = Mode.OFFICIAL) {
    const tag = `q_${getQueueId(mode)}`;
    const url = `${sgpServer}/match-history-query/v1/products/lol/player/${puuid}/SUMMARY` +
                `?startIndex=${startIndex}&count=${CRAWL_BATCH_SIZE}&tag=${tag}`;

    let resp = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenRef.value}` },
    });

    // Token rotation guard: refresh once and retry the same request
    if (resp.status === 401) {
        Utils.Debug.warn(`[MD-Crawler] SGP 401 for ${puuid.slice(0, 8)}… - refreshing token and retrying`);
        const refreshed = await refreshToken(tokenRef, true);
        if (refreshed) {
            resp = await fetch(url, {
                headers: { Authorization: `Bearer ${tokenRef.value}` },
            });
        }
    }

    if (!resp.ok) {
        if (resp.status !== 401) {
            Utils.Debug.warn(`[MD-Crawler] SGP ${resp.status} for ${puuid.slice(0, 8)}… - skipped`);
        }
        return [];
    }
    const data = await resp.json();
    return data.games || [];
}

/**
 * Processes a single raw game into the crawler's accumulator.
 * Returns the list of participant PUUIDs for queue expansion.
 */
function processGame(rawGame, targetPatch, accum, mode = Mode.OFFICIAL) {
    const detail = rawGame.json;
    if (!detail) return { participants: [], isValid: false };
    if (!getValidQueueIds(mode).includes(detail.queueId)) return { participants: [], isValid: false };

    const participantPuuids = detail.participants.map(p => p.puuid);

    // Patch filter skip STATS accumulation if not on the target patch
    const gamePatch = toPatchLabel(detail.gameVersion || '');
    if (targetPatch && gamePatch !== targetPatch) return { participants: participantPuuids, isValid: false };
    if (gamePatch && gamePatch !== 'Unknown') accum.seenPatches.add(gamePatch);

    // Game-level dedup
    const gameCreation = detail.gameCreation;
    if (accum.processedGameIds.has(gameCreation)) return { participants: participantPuuids, isValid: false };
    accum.processedGameIds.add(gameCreation);
    
    // Periodically prune oldest entries if the set grows beyond the configured cap.
    try {
        if (!accum._processedSincePrune) accum._processedSincePrune = 0;
        accum._processedSincePrune++;
        const PRUNE_INTERVAL = 1000;
        if (accum._processedSincePrune >= PRUNE_INTERVAL) {
            accum._processedSincePrune = 0;
            while (accum.processedGameIds.size > PROCESSED_GAME_IDS_MAX) {
                const it = accum.processedGameIds.values();
                const oldest = it.next().value;
                if (oldest === undefined) break;
                accum.processedGameIds.delete(oldest);
            }
        }
    } catch (e) {
        Utils.Debug.error('[MD-Crawler] processedGameIds prune failed:', e);
    }

    // Remake check
    const isRemake =
        detail.gameDuration < 180 &&
        detail.participants.some(p => p.teamEarlySurrendered);

    accum.totalGames++;

    for (const part of detail.participants) {
        if (isRemake) continue;

        const champId = String(part.championId);
        const win = part.win;

        if (!accum.champions[champId]) {
            accum.champions[champId] = {
                s: { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, dmg: 0 },
                g: [],
            };
        }

        const cS = accum.champions[champId].s;
        cS.games++;
        if (win) cS.wins++;
        cS.kills   += part.kills   || 0;
        cS.deaths  += part.deaths  || 0;
        cS.assists += part.assists || 0;
        cS.dmg     += part.totalDamageDealtToChampions || 0;

        // Derive items
        const itemSlots = [
            part.item0, part.item1, part.item2,
            part.item3, part.item4, part.item5, part.item6,
        ];
        const orderedBuild = deriveOrderedBuild(
            itemSlots,
            part.challenges?.legendaryItemUsed,
        );
        const finalItems = itemSlots.filter(id => id && !BLACKLIST_ITEM_IDS.has(id));

        const augments = [
            part.playerAugment1, part.playerAugment2, part.playerAugment3,
            part.playerAugment4, part.playerAugment5, part.playerAugment6,
        ].filter(id => id);

        _bufferGameRecord(champId, [win ? 1 : 0, finalItems, augments, orderedBuild, gameCreation]);
    }

    return { participants: participantPuuids, isValid: true };
}

/**
 * Processes one PUUID: fetches up to maxBatches of games, accumulates stats,
 * and returns new PUUIDs to enqueue.
 */
async function processPlayer(puuid, sgpServer, tokenRef, targetPatch, accum, maxBatches = 1, mode = Mode.OFFICIAL) {
    const newPuuids = [];
    let consecutiveEmptyBatches = 0;

    for (let i = 0; i < maxBatches; i++) {
        // Stop fetching for this player if we hit the global target
        if (accum.totalGames >= getSettings().crawlTargetGames) break;

        // Throttle consecutive requests for the same player to avoid bursting
        if (i > 0 && getSettings().crawlDelayMs > 0) {
            await delay(getSettings().crawlDelayMs);
        }

        const rawBatch = await fetchRawBatch(puuid, sgpServer, tokenRef, i * CRAWL_BATCH_SIZE, mode);
        
        // If the API returns nothing, this player has no more games.
        if (rawBatch.length === 0) break;
        
        let foundNewParticipants = false;

        for (const rawGame of rawBatch) {
            if (accum.totalGames >= getSettings().crawlTargetGames) break;
            
            const { participants, isValid } = processGame(rawGame, targetPatch, accum, mode);
            
            if (participants.length > 0) {
                foundNewParticipants = true;
            }
            
            for (const p of participants) {
                if (!accum.visited.has(p)) newPuuids.push(p);
            }
        }
        
        if (!foundNewParticipants) {
            consecutiveEmptyBatches++;
            if (consecutiveEmptyBatches >= 2) break;
        } else {
            consecutiveEmptyBatches = 0;
        }
        
        // If the batch returned fewer than 20 games, we've reached the very end of their history.
        if (rawBatch.length < CRAWL_BATCH_SIZE) break;
    }
    return newPuuids;
}

// Main crawl loop

/**
 * Starts or resumes a global champion data crawl.
 *
 * @param {string}   myPuuid     Starting seed (current user's PUUID)
 * @param {string}   sgpServer   SGP base URL
 * @param {string}   rsoToken    Bearer token
 * @param {string}   targetPatch e.g. "15.8" or null to skip patch filter
 * @param {function} onProgress  Called with progress payloads
 */
export async function startCrawl(myPuuid, sgpServer, rsoToken, targetPatch, onProgress, mode = Mode.OFFICIAL) {
    if (_running) return;
    _running    = true;
    _cancelFlag = false;

    // Mutable token holder so periodic refresh + 401 guard can swap in a new token
    const tokenRef = { value: rsoToken, fetchedAt: Date.now() };

    const report = (phase, extra = {}) => {
        try {
            onProgress({
                phase,
                totalGames:     accum.totalGames,
                visitedPlayers: accum.visited.size,
                queueSize:      queue.length,
                ...extra,
            });
        } catch {}
    };

    // Load or init accumulator
    let resume = readCrawlState(mode);
    const isSamePatch = resume && (!targetPatch || resume.patch === targetPatch);

    // Accumulator holds the unpacked in-memory state during a crawl run
    const accum = {
        champions: {},
        processedGameIds: new Set(),
        visited: new Set(),
        totalGames: 0,
        seenPatches: new Set(),
    };

    let queue = [];
    let queueSet = new Set();

    if (resume && isSamePatch) {
        // Restore state from a previous (possibly partial) crawl
        accum.processedGameIds = resume.processedGameIds;
        accum.visited          = resume.visited;
        accum.totalGames       = resume.totalGames;
        accum.seenPatches      = new Set(resume.seenPatches || []);
        queue = resume.queue;
        queueSet = new Set(queue);

        // Handle empty queue: old broken saves or natural queue drainage
        // can leave queue=[] even when target not reached.
        // Fix: un-visit a sample of already-processed players and push them
        // back into the queue. Their games will be deduped by processedGameIds
        // (no double-counting) but their participants will be re-discovered,
        // refilling the queue for continued BFS expansion.
        if (queue.length === 0 && accum.totalGames < getSettings().crawlTargetGames && accum.visited.size > 0) {
            const visitedArr = [...accum.visited];
            const reseedCount = Math.min(30, visitedArr.length);

            // Previously: visitedArr.slice(-reseedCount) - took the most recently
            // visited players (frontier nodes), whose neighbours were already exhausted,
            // causing the reseed to spin in the same graph cluster.
            //
            // Now: random sample across all visited players so the BFS can discover
            // parts of the graph whose neighbours were never fully explored.
            shuffle(visitedArr);
            const reseed = visitedArr.slice(0, reseedCount);

            reseed.forEach(p => {
                accum.visited.delete(p);
                queue.push(p);
            });
            report('running', { message: `Queue was empty - re-seeding from ${reseed.length} previously visited players…` });
        } else {
            report('running', { message: `Resuming crawl (${accum.totalGames.toLocaleString()} games already collected)…` });
        }

    } else {
        // Fresh crawl - clear old state
        clearCrawlState(mode);
        queue = [myPuuid];
        
        try {
            const idx = readCacheIndex(mode);
            if (idx && Array.isArray(idx.puuids)) {
                for (const p of idx.puuids) {
                    if (p !== myPuuid) queue.push(p);
                }
            }
        } catch (e) {}

        queueSet = new Set(queue);
        report('running', { message: 'Starting fresh crawl…' });
    }

    // Load existing champion stats into the accumulator so both fresh and
    // resumed crawls preserve previously-collected s[] data.  On resume,
    // processedGameIds prevents double-counting.
    const existing = readGlobalStats(mode);
    if (existing) {
        for (const [champId, cS] of Object.entries(existing.stats.champions)) {
            if (!accum.champions[champId]) {
                accum.champions[champId] = { s: { ...cS }, g: [] };
            }
        }
        // If we lost the crawl state but stats exist, inherit the totals 
        // to prevent crawler from zeroing out total games.
        if (!resume) {
            accum.totalGames = existing.meta.totalGames || 0;
            const prevVisited = existing.meta.visitedCount || 0;
            if (existing.meta && existing.meta.seenPatches) {
                existing.meta.seenPatches.forEach(p => accum.seenPatches.add(p));
            }
            // Pad the visited set with dummy keys to restore its `.size` property visually
            // without interfering with actual PUUID `has()` checks.
            for (let i = 0; i < prevVisited; i++) {
                accum.visited.add(`dummy-${i}`);
            }

            // Populate processedGameIds from existing game records so a fresh
            // crawl never re-processes games already in the saved data.
            if (existing.champGames) {
                for (const records of Object.values(existing.champGames)) {
                    for (const rec of records) {
                        if (rec.gameCreation) {
                            accum.processedGameIds.add(rec.gameCreation);
                        }
                    }
                }
                if (accum.processedGameIds.size > 0) {
                    report('running', { message: `Indexed ${accum.processedGameIds.size.toLocaleString()} existing games for dedup.` });
                }
            }
        }
        clearGlobalStatsCache(mode);
    }

    // Strip g[] game records from DataStore into the in-memory game buffer.
    // Since we do zero writes to md-global-stats during the crawl, the file
    // stays tiny on disk.  Records are written back once at crawl end via
    // _persistFinalStats.
    try {
        const strippedG = stripGameRecordsFromStore(mode);
        for (const [champId, records] of Object.entries(strippedG)) {
            if (!_gameBuffer[champId]) _gameBuffer[champId] = [];
            for (const rec of records) _gameBuffer[champId].push(rec);
            _gameBufferCount += records.length;
        }
    } catch (e) {
        Utils.Debug.error('[MD-Crawler] Failed to strip g[] from DataStore at crawl start:', e);
    }

    let playersSinceLastSave = 0;
    // Track only NEW players added during THIS session so the cap resets on resume.
    // Without this, a resumed crawl with e.g. 601 already-visited would immediately
    // hit the CRAWL_MAX_PLAYERS=600 cap and exit without doing any work.
    let newPlayersThisSession = 0;

    // Main BFS loop
    try {
        while (
            queue.length > 0 &&
            accum.totalGames < getSettings().crawlTargetGames &&
            newPlayersThisSession < getSettings().crawlMaxPlayers &&
            !_cancelFlag
        ) {
            // Shuffle periodically to avoid clustering
            if (accum.visited.size % 50 === 0 && accum.visited.size > 0) {
                shuffle(queue);
            }

            // Drain duplicate PUUIDs from the front of the queue
            while (queue.length > 0 && accum.visited.has(queue[0])) {
                const p = queue.shift();
                queueSet.delete(p);
            }
            if (queue.length === 0) break;

            // Concurrent batch 
            const batchSize = Math.min(getSettings().crawlMaxConcurrent, queue.length);
            const batch     = [];

            for (let i = 0; i < batchSize; i++) {
                const puuid = queue.shift();
                queueSet.delete(puuid);
                if (!puuid || accum.visited.has(puuid)) continue;
                accum.visited.add(puuid);
                newPlayersThisSession++;
                batch.push(puuid);
            }

            if (batch.length === 0) continue;

            await refreshToken(tokenRef);

            report('running', {
                message: `Processing ${batch.length} player(s)… ` +
                         `${accum.totalGames.toLocaleString()} games · ` +
                         `${accum.visited.size} players visited`,
            });

            // Fire workers concurrently but stagger their start times to prevent burst hits
            const workerResults = await Promise.allSettled(
                batch.map((puuid, index) => {
                    const digDeep = accum.visited.size <= getSettings().crawlMaxConcurrent * 2;
                    return (async () => {
                        // Stagger the startup of each concurrent worker sequentially
                        if (index > 0 && getSettings().crawlDelayMs > 0) {
                            await delay(index * getSettings().crawlDelayMs);
                        }
                        return processPlayer(puuid, sgpServer, tokenRef, targetPatch, accum, digDeep ? 5 : 1, mode);
                    })().then(newPuuids => ({ newPuuids }));
                })
            );

            for (const res of workerResults) {
                if (res.status === 'fulfilled') {
                    for (const p of res.value.newPuuids) {
                        if (!accum.visited.has(p) && !queueSet.has(p) && queue.length < 10000) {
                            queue.push(p);
                            queueSet.add(p);
                        }
                    }
                }
            }
            // Wait between requests
            if (getSettings().crawlDelayMs > 0) {
                await delay(getSettings().crawlDelayMs);
            }

            playersSinceLastSave += batch.length;

            // Periodic save - crawl state only (md-global-crawl).
            // No writes to md-global-stats; everything persists at crawl end.
            if (playersSinceLastSave >= getSettings().crawlSaveEvery) {
                playersSinceLastSave = 0;
                saveCrawlState({
                    patch: targetPatch,
                    queue: [...queue],
                    visited: accum.visited,
                    processedGameIds: accum.processedGameIds,
                    totalGames: accum.totalGames,
                    startedAt: resume?.startedAt || Date.now(),
                }, mode);
            }
        }
    } catch (e) {
        Utils.Debug.error('[MD-Crawler] Crawl error:', e);
        // Save progress before surfacing the error
        saveCrawlState({
            patch: targetPatch,
            queue: [...queue],
            visited: accum.visited,
            processedGameIds: accum.processedGameIds,
            totalGames: accum.totalGames,
            seenPatches: accum.seenPatches,
            startedAt: resume?.startedAt || Date.now(),
        }, mode);
        commitCrawlState(mode);
        // Persist all stats (s[] + g[]) in one write.
        _persistFinalStats(accum, targetPatch, mode);
        _running = false;
        report('error', { error: e.message, message: `Crawl error: ${e.message}` });
        return;
    }

    // Write final stats (s[] + g[]) to DataStore in a single operation.
    _persistFinalStats(accum, targetPatch, mode);

    const reachedTarget = accum.totalGames >= getSettings().crawlTargetGames;

    if (_cancelFlag || !reachedTarget) {
        // Cancelled OR stopped early (player cap / queue empty before reaching target).
        // Save the remaining queue so the crawl can be resumed.
        saveCrawlState({
            patch: targetPatch,
            queue: [...queue],
            visited: accum.visited,
            processedGameIds: accum.processedGameIds,
            totalGames: accum.totalGames,
            seenPatches: accum.seenPatches,
            startedAt: resume?.startedAt || Date.now(),
        }, mode);
        commitCrawlState(mode);
        _running = false;
        if (_cancelFlag) {
            report('cancelled', { message: `Cancelled - ${accum.totalGames.toLocaleString()} games saved. Click Resume to continue.` });
        } else {
            // Stopped because per-session player cap was hit; more progress possible
            report('done', {
                message: `Session complete - ${accum.totalGames.toLocaleString()} games so far · ` +
                         `${accum.visited.size} players total. ` +
                         (queue.length > 0 ? 'Click Resume to continue.' : 'Queue exhausted.'),
            });
        }
    // Teardown: clear large in-memory structures so CEF can reclaim memory.
    try {
        // Clear accumulator sets and champion maps
        if (accum) {
            if (accum.processedGameIds && typeof accum.processedGameIds.clear === 'function') accum.processedGameIds.clear();
            if (accum.visited && typeof accum.visited.clear === 'function') accum.visited.clear();
            accum.champions = {};
            accum.processedGameIds = null;
            accum.visited = null;
        }
    } catch (e) {}

    try {
        queue.length = 0;
        queueSet = null;
    } catch (e) {}

    // Drop module-level buffer
    try {
        _gameBuffer = {};
        _gameBufferCount = 0;
    } catch (e) {}
    } else {
        // Target reached - truly done, no need to resume
        saveCrawlState({
            patch: targetPatch,
            queue: [], // intentionally empty: target met
            visited: accum.visited,
            processedGameIds: accum.processedGameIds,
            totalGames: accum.totalGames,
            seenPatches: accum.seenPatches,
            startedAt: resume?.startedAt || Date.now(),
        }, mode);
        commitCrawlState(mode);
        _running = false;
        report('done', {
            message: `Complete! ${accum.totalGames.toLocaleString()} unique games · ` +
                     `${accum.visited.size} players · ` +
                     `${Object.keys(accum.champions).length} champions covered.`,
        });
    }
}