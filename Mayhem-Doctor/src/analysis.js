/**
 * Core pipeline: parse raw SGP games → accumulate stats → fetch with cache
 * expose the two public entry points used by UI.
 */

import { VALID_QUEUE_IDS, BLACKLIST_ITEM_IDS } from './config.js';
import { LCU_API, getSgpContext, resolvePuuid, setMyPuuid } from './lcu.js';
import { readCacheEntry, saveCacheEntry } from './cache.js';

//  Game parser 
/**
 * Parses one raw SGP game into a compact history entry for a given PUUID.
 * Returns null if the game is wrong mode or the player isn't found.
 */
export function parseGame(g, puuid) {
    const detail = g.json;
    if (!detail || !VALID_QUEUE_IDS.includes(detail.queueId)) return null;
    const p = detail.participants.find(part => part.puuid === puuid);
    if (!p) return null;
    const isRemake = detail.gameDuration < 180 && detail.participants.some(part => part.teamEarlySurrendered);

    // Build order: legendaries first (chronological pick order "legendaryItemUsed"), then remaining items
    const finalItems = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6]
        .filter(id => id && !BLACKLIST_ITEM_IDS.has(id));
    const rawLegendaries    = p.challenges?.legendaryItemUsed || [];
    const uniqueLegendaries = [...new Set(rawLegendaries)];
    const keptLegendaries   = uniqueLegendaries.filter(id => finalItems.includes(id));
    const otherItems        = finalItems.filter(id => !keptLegendaries.includes(id));
    const orderedBuild      = [...keptLegendaries, ...otherItems];

    // Compact raw game — only fields needed by match-view rendering
    const compactRawGame = {
        json: {
            queueId: detail.queueId,
            gameDuration: detail.gameDuration,
            gameVersion: detail.gameVersion,
            gameCreation: detail.gameCreation,
            mapId: detail.mapId,
            participants: detail.participants.map(part => ({
                // IDENTITY
                puuid: part.puuid,
                riotIdGameName: part.riotIdGameName,
                riotIdTagline: part.riotIdTagline,
                summonerName: part.summonerName,
                championName: part.championName,
                championId: part.championId,
                teamId: part.teamId,
                win: part.win,
                // KDA & ECO
                kills: part.kills,
                deaths: part.deaths,
                assists: part.assists,
                goldEarned: part.goldEarned,
                totalMinionsKilled: part.totalMinionsKilled,
                neutralMinionsKilled: part.neutralMinionsKilled,
                // DAMAGE DEALT
                totalDamageDealtToChampions: part.totalDamageDealtToChampions,
                physicalDamageDealtToChampions: part.physicalDamageDealtToChampions,
                magicDamageDealtToChampions: part.magicDamageDealtToChampions,
                trueDamageDealtToChampions: part.trueDamageDealtToChampions,
                totalDamageDealt: part.totalDamageDealt,
                // DAMAGE TAKEN & MITIGATED
                totalDamageTaken: part.totalDamageTaken,
                physicalDamageTaken: part.physicalDamageTaken,
                magicDamageTaken: part.magicDamageTaken,
                trueDamageTaken: part.trueDamageTaken,
                damageSelfMitigated: part.damageSelfMitigated,
                // HEALING & SHIELDING
                totalHeal: part.totalHeal,
                totalHealsOnTeammates: part.totalHealsOnTeammates,
                totalDamageShieldedOnTeammates: part.totalDamageShieldedOnTeammates,
                // OBJECTIVES & FLAGS
                firstBloodKill: part.firstBloodKill,
                firstBloodAssist: part.firstBloodAssist,
                firstTowerKill: part.firstTowerKill,
                firstTowerAssist: part.firstTowerAssist,
                turretTakedowns: part.turretTakedowns,
                inhibitorTakedowns: part.inhibitorTakedowns,
                // Items and Summs
                spell1Id: part.spell1Id,
                spell2Id: part.spell2Id,
                item0: part.item0, item1: part.item1, item2: part.item2,
                item3: part.item3, item4: part.item4, item5: part.item5, item6: part.item6,
                // AUGMENTS
                playerAugment1: part.playerAugment1, playerAugment2: part.playerAugment2,
                playerAugment3: part.playerAugment3, playerAugment4: part.playerAugment4,
                playerAugment5: part.playerAugment5, playerAugment6: part.playerAugment6,
                // For legendaryItemUsed
                challenges: { legendaryItemUsed: part.challenges?.legendaryItemUsed || [] }
            }))
        }
    };

    return {
        result: isRemake ? 'Remake' : (p.win ? 'Win' : 'Loss'),
        championName: p.championName,
        championId: p.championId,
        kda: `${p.kills}/${p.deaths}/${p.assists}`,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        dmg: p.totalDamageDealtToChampions,
        items: finalItems,
        orderedBuild,
        augments: [p.playerAugment1, p.playerAugment2, p.playerAugment3, p.playerAugment4, p.playerAugment5, p.playerAugment6].filter(id => id),
        gameCreation: detail.gameCreation,
        gameDuration: detail.gameDuration,
        gameVersion: detail.gameVersion,
        rawGame: compactRawGame
    };
}

//  Stats accumulator 
/** Merges a parsed history entry into the running stats object. */
export function accumulateStats(stats, entry) {
    if (entry.result === 'Remake') { stats.remakes++; return; }
    if (entry.result === 'Win') stats.wins++; else stats.losses++;
    const win = entry.result === 'Win';
    const cId = entry.championId;
    if (!stats.champions[cId]) stats.champions[cId] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, dmg: 0 };
    const cS = stats.champions[cId];
    cS.games++; if (win) cS.wins++;
    cS.kills += entry.kills; cS.deaths += entry.deaths; cS.assists += entry.assists;
    cS.dmg += entry.dmg;
    entry.items.forEach(iId => {
        if (!stats.items[iId]) stats.items[iId] = { games: 0, wins: 0 };
        stats.items[iId].games++; if (win) stats.items[iId].wins++;
    });
    entry.augments.forEach(aId => {
        if (!stats.augments[aId]) stats.augments[aId] = { games: 0, wins: 0 };
        stats.augments[aId].games++; if (win) stats.augments[aId].wins++;
    });
}

//  SGP fetcher 
/**
 * Fetches desired games from SGP starting at startIndex, parsing and appending
 * to fullHistory until requestedCount is reached or the API is exhausted.
 *
 * @returns {{ history: Array, oldestStartIndex: number }}
 */
export async function fetchGamesFromSGP(puuid, requestedCount, sgpServer, rsoToken, fullHistory, startIndex, onProgress) {
    const BATCH_SIZE = 20;
    const MAX_EMPTY_BATCHES = 5; // 0 desired games per batch request threshold
    let consecutiveEmptyBatches = 0;
    let currentStartIndex = startIndex;
    let oldestAcceptedStartIndex = startIndex;

    while (fullHistory.length < requestedCount) {
        onProgress({ status: `Fetching batch ${Math.floor(currentStartIndex / BATCH_SIZE) + 1}… Found ${fullHistory.length}/${requestedCount}` });
        const url = `${sgpServer}/match-history-query/v1/products/lol/player/${puuid}/SUMMARY?startIndex=${currentStartIndex}&count=${BATCH_SIZE}`;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${rsoToken}` } });
        if (!response.ok) break;
        const data = await response.json();
        const batch = data.games || [];
        if (batch.length === 0) break;

        let foundValidInBatch = false;
        for (const g of batch) {
            if (fullHistory.length >= requestedCount) break;
            const entry = parseGame(g, puuid);
            if (!entry) continue;
            fullHistory.push(entry);
            foundValidInBatch = true;
            oldestAcceptedStartIndex = currentStartIndex;
        }
        if (!foundValidInBatch) consecutiveEmptyBatches++;
        else consecutiveEmptyBatches = 0;
        if (consecutiveEmptyBatches >= MAX_EMPTY_BATCHES) break;
        if (batch.length < BATCH_SIZE) break;
        currentStartIndex += BATCH_SIZE;
        await new Promise(r => setTimeout(r, 50));
    }
    return { history: fullHistory, oldestStartIndex: oldestAcceptedStartIndex };
}

//  Core analysis orchestrator 
/**
 * Cache aware ie. Probes SGP for new games, stitches with cache,
 * fetches older games as needed.
 *
 * Calls onProgress({ status }) during fetching.
 * Calls onProgress({ finalStats, fullHistory }) on completion.
 */
export async function runAnalysis(puuid, requestedGameCount, sgpServer, rsoToken, onProgress) {
    const stats = { wins: 0, losses: 0, remakes: 0, champions: {}, items: {}, augments: {} };
    const BATCH_SIZE = 20;
    const MAX_PROBE_BATCHES = 5;

    const cachedEntry = readCacheEntry(puuid);

    // No cache, straight fetch
    if (!cachedEntry) {
        const result = await fetchGamesFromSGP(puuid, requestedGameCount, sgpServer, rsoToken, [], 0, onProgress);
        const fullHistory = result.history;
        fullHistory.forEach(e => accumulateStats(stats, e));
        if (fullHistory.length > 0) saveCacheEntry(puuid, fullHistory, result.oldestStartIndex);
        onProgress({ finalStats: stats, fullHistory });
        return;
    }

    // Probe for games newer than the cache top
    let newerGames = [];
    let probeStartIndex = 0;
    let probeBatches = 0;
    let foundBoundary = false;
    while (probeBatches < MAX_PROBE_BATCHES && !foundBoundary) {
        const url = `${sgpServer}/match-history-query/v1/products/lol/player/${puuid}/SUMMARY?startIndex=${probeStartIndex}&count=${BATCH_SIZE}`;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${rsoToken}` } });
        if (!response.ok) break;
        const data = await response.json();
        const batch = data.games || [];
        if (batch.length === 0) break;
        for (const g of batch) {
            const entry = parseGame(g, puuid);
            if (!entry) continue;
            if (entry.gameCreation === cachedEntry.newestGameCreation) { foundBoundary = true; break; }
            newerGames.push(entry);
        }
        if (batch.length < BATCH_SIZE) break;
        probeStartIndex += BATCH_SIZE;
        probeBatches++;
    }

    // Cache is stale (couldn't find the boundary within MAX_PROBE_BATCHES)
    if (!foundBoundary && newerGames.length > 0) {
        const result = await fetchGamesFromSGP(puuid, requestedGameCount, sgpServer, rsoToken, [], 0, onProgress);
        const fullHistory = result.history;
        fullHistory.forEach(e => accumulateStats(stats, e));
        if (fullHistory.length > 0) saveCacheEntry(puuid, fullHistory, result.oldestStartIndex);
        onProgress({ finalStats: stats, fullHistory });
        return;
    }

    let mergedHistory = [...newerGames, ...cachedEntry.history];

    // Full cache hit
    if (mergedHistory.length >= requestedGameCount) {
        const slice = mergedHistory.slice(0, requestedGameCount);
        slice.forEach(e => accumulateStats(stats, e));
        saveCacheEntry(puuid, mergedHistory, cachedEntry.oldestStartIndex);
        onProgress({ finalStats: stats, fullHistory: slice });
        return;
    }

    // Need older games aka partial, continue from where the cache left off
    const result = await fetchGamesFromSGP(puuid, requestedGameCount, sgpServer, rsoToken, mergedHistory,
                                            cachedEntry.oldestStartIndex + BATCH_SIZE, onProgress);
    mergedHistory = result.history;
    mergedHistory.forEach(e => accumulateStats(stats, e));
    saveCacheEntry(puuid, mergedHistory, result.oldestStartIndex);
    onProgress({ finalStats: stats, fullHistory: mergedHistory });
}

//  Public entry points 
/** Analyse the currently logged-in player's Mayhem history. */
export async function startSelfAnalysis(updateUICallback, requestedGameCount) {
    try {
        updateUICallback({ status: 'Connecting to Riot Servers…' });
        const { rso, sgpServer } = await getSgpContext();
        const user = await LCU_API.get('/lol-summoner/v1/current-summoner');
        setMyPuuid(user.puuid);
        await runAnalysis(user.puuid, requestedGameCount, sgpServer, rso.token, updateUICallback);
    } catch (e) { updateUICallback({ error: e.message }); }
}

/** Analyse another player's Mayhem history by Riot ID ("GameName#TAG"). */
export async function startInvestigatorAnalysis(updateUICallback, riotId, requestedGameCount) {
    try {
        updateUICallback({ status: `Resolving Riot ID "${riotId}"…` });
        const { rso, sgpServer } = await getSgpContext();
        const { puuid, displayName } = await resolvePuuid(riotId);
        setMyPuuid(puuid);
        updateUICallback({ status: `Found ${displayName} — fetching Mayhem history…` });
        await runAnalysis(puuid, requestedGameCount, sgpServer, rso.token, updateUICallback);
    } catch (e) { updateUICallback({ error: e.message }); }
}
