/**
 * Core pipeline: parse raw SGP games → accumulate stats → fetch with cache
 * expose the two public entry points used by UI.
 */

import { VALID_QUEUE_IDS, BLACKLIST_ITEM_IDS } from "./config.js";
import { LCU_API, getSgpContext, resolvePuuid, setMyPuuid } from "./lcu.js";
import { readCacheEntry, saveCacheEntry, readCacheIndex } from "./cache.js";
import { loadSettings } from "./ui/settings.js";

// Laplace smoothing prior strength.
// Adds k pseudo-games at 50% WR before any ranking computation.
// Pulls small-n estimates toward 50% and lets large-n drift to their true rate.
const LAPLACE_K = 3;

export function smoothedWinRate(wins, games) {
  return ((wins + LAPLACE_K) / (games + 2 * LAPLACE_K)) * 100;
}

// Shared build-order derivation used by parseGame and buildGlobalStats
export function deriveOrderedBuild(itemSlots, legendaryItemsUsed) {
  const finalItems = itemSlots.filter(
    (id) => id && !BLACKLIST_ITEM_IDS.has(id),
  );
  const rawLegendaries = legendaryItemsUsed || [];
  const uniqueLegendaries = [...new Set(rawLegendaries)];
  const keptLegendaries = uniqueLegendaries.filter((id) =>
    finalItems.includes(id),
  );
  const otherItems = finalItems.filter((id) => !keptLegendaries.includes(id));
  return [...keptLegendaries, ...otherItems];
}

//  Game parser
/**
 * Parses one raw SGP game into a compact history entry for a given PUUID.
 * Returns null if the game is wrong mode or the player isn't found.
 */
export function parseGame(g, puuid) {
  const detail = g.json;
  if (!detail || !VALID_QUEUE_IDS.includes(detail.queueId)) return null;
  const p = detail.participants.find((part) => part.puuid === puuid);
  if (!p) return null;
  const isRemake =
    detail.gameDuration < 180 &&
    detail.participants.some((part) => part.teamEarlySurrendered);

  const itemSlots = [
    p.item0,
    p.item1,
    p.item2,
    p.item3,
    p.item4,
    p.item5,
    p.item6,
  ];
  const orderedBuild = deriveOrderedBuild(
    itemSlots,
    p.challenges?.legendaryItemUsed,
  );
  const finalItems = itemSlots.filter(
    (id) => id && !BLACKLIST_ITEM_IDS.has(id),
  );

  const compactRawGame = {
    json: {
      queueId: detail.queueId,
      gameDuration: detail.gameDuration,
      gameVersion: detail.gameVersion,
      gameCreation: detail.gameCreation,
      mapId: detail.mapId,
      participants: detail.participants.map((part) => ({
        puuid: part.puuid,
        riotIdGameName: part.riotIdGameName,
        riotIdTagline: part.riotIdTagline,
        summonerName: part.summonerName,
        championName: part.championName,
        championId: part.championId,
        teamId: part.teamId,
        win: part.win,
        kills: part.kills,
        deaths: part.deaths,
        assists: part.assists,
        goldEarned: part.goldEarned,
        totalMinionsKilled: part.totalMinionsKilled,
        neutralMinionsKilled: part.neutralMinionsKilled,
        totalDamageDealtToChampions: part.totalDamageDealtToChampions,
        physicalDamageDealtToChampions: part.physicalDamageDealtToChampions,
        magicDamageDealtToChampions: part.magicDamageDealtToChampions,
        trueDamageDealtToChampions: part.trueDamageDealtToChampions,
        totalDamageDealt: part.totalDamageDealt,
        totalDamageTaken: part.totalDamageTaken,
        physicalDamageTaken: part.physicalDamageTaken,
        magicDamageTaken: part.magicDamageTaken,
        trueDamageTaken: part.trueDamageTaken,
        damageSelfMitigated: part.damageSelfMitigated,
        totalHeal: part.totalHeal,
        totalHealsOnTeammates: part.totalHealsOnTeammates,
        totalDamageShieldedOnTeammates: part.totalDamageShieldedOnTeammates,
        firstBloodKill: part.firstBloodKill,
        firstBloodAssist: part.firstBloodAssist,
        firstTowerKill: part.firstTowerKill,
        firstTowerAssist: part.firstTowerAssist,
        turretTakedowns: part.turretTakedowns,
        inhibitorTakedowns: part.inhibitorTakedowns,
        spell1Id: part.spell1Id,
        spell2Id: part.spell2Id,
        item0: part.item0,
        item1: part.item1,
        item2: part.item2,
        item3: part.item3,
        item4: part.item4,
        item5: part.item5,
        item6: part.item6,
        playerAugment1: part.playerAugment1,
        playerAugment2: part.playerAugment2,
        playerAugment3: part.playerAugment3,
        playerAugment4: part.playerAugment4,
        playerAugment5: part.playerAugment5,
        playerAugment6: part.playerAugment6,
        challenges: {
          legendaryItemUsed: part.challenges?.legendaryItemUsed || [],
        },
      })),
    },
  };

  return {
    result: isRemake ? "Remake" : p.win ? "Win" : "Loss",
    championName: p.championName,
    championId: p.championId,
    kda: `${p.kills}/${p.deaths}/${p.assists}`,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    dmg: p.totalDamageDealtToChampions,
    gold: p.goldEarned,
    minions: p.totalMinionsKilled + (p.neutralMinionsKilled || 0),
    multikill: p.largestMultiKill || 0,
    items: finalItems,
    orderedBuild,
    augments: [
      p.playerAugment1,
      p.playerAugment2,
      p.playerAugment3,
      p.playerAugment4,
      p.playerAugment5,
      p.playerAugment6,
    ].filter((id) => id),
    gameCreation: detail.gameCreation,
    gameDuration: detail.gameDuration,
    gameVersion: detail.gameVersion,
    rawGame: compactRawGame,
  };
}

//  Stats accumulator
/** Merges a parsed history entry into the running stats object. */
export function accumulateStats(stats, entry) {
  if (entry.result === "Remake") {
    stats.remakes++;
    return;
  }
  if (entry.result === "Win") stats.wins++;
  else stats.losses++;
  const win = entry.result === "Win";
  const cId = entry.championId;
  if (!stats.champions[cId])
    stats.champions[cId] = {
      games: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      dmg: 0,
    };
  const cS = stats.champions[cId];
  cS.games++;
  if (win) cS.wins++;
  cS.kills += entry.kills;
  cS.deaths += entry.deaths;
  cS.assists += entry.assists;
  cS.dmg += entry.dmg;
  entry.items.forEach((iId) => {
    if (!stats.items[iId]) stats.items[iId] = { games: 0, wins: 0 };
    stats.items[iId].games++;
    if (win) stats.items[iId].wins++;
  });
  entry.augments.forEach((aId) => {
    if (!stats.augments[aId]) stats.augments[aId] = { games: 0, wins: 0 };
    stats.augments[aId].games++;
    if (win) stats.augments[aId].wins++;
  });
}

/**
 * Builds aggregated stats across ALL participants in every game in fullHistory,
 * not just the focal player. Returns the same stats shape as accumulateStats produces,
 * plus per-champion game records with orderedBuild derived for every participant.
 *
 * champGames[championId] = [{ win, items, augments, orderedBuild }, ...]
 * champItemStats[championId][itemId] = { games, wins }
 * champAugStats[championId][augId]   = { games, wins }
 */
export function buildGlobalStats(fullHistory) {
  const stats = {
    wins: 0,
    losses: 0,
    remakes: 0,
    champions: {},
    items: {},
    augments: {},
  };
  const champGames = {};
  const champItemStats = {};
  const champAugStats = {};

  fullHistory.forEach((h) => {
    const raw = h.rawGame?.json;
    if (!raw) return;

    const isRemake = h.result === "Remake";

    raw.participants.forEach((part) => {
      const win = part.win;
      const cId = part.championId;
      const cKey = String(cId);

      if (!stats.champions[cId])
        stats.champions[cId] = {
          games: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          dmg: 0,
        };
      if (!isRemake) {
        stats.champions[cId].games++;
        if (win) stats.champions[cId].wins++;
        stats.champions[cId].kills += part.kills;
        stats.champions[cId].deaths += part.deaths;
        stats.champions[cId].assists += part.assists;
        stats.champions[cId].dmg += part.totalDamageDealtToChampions || 0;
        if (win) stats.wins++;
        else stats.losses++;
      } else {
        stats.remakes++;
      }

      const itemSlots = [
        part.item0,
        part.item1,
        part.item2,
        part.item3,
        part.item4,
        part.item5,
        part.item6,
      ];
      const orderedBuild = deriveOrderedBuild(
        itemSlots,
        part.challenges?.legendaryItemUsed,
      );
      const finalItems = itemSlots.filter(
        (id) => id && !BLACKLIST_ITEM_IDS.has(id),
      );
      const augments = [
        part.playerAugment1,
        part.playerAugment2,
        part.playerAugment3,
        part.playerAugment4,
        part.playerAugment5,
        part.playerAugment6,
      ].filter((id) => id);

      if (!isRemake) {
        finalItems.forEach((iId) => {
          if (!stats.items[iId]) stats.items[iId] = { games: 0, wins: 0 };
          stats.items[iId].games++;
          if (win) stats.items[iId].wins++;
          if (!champItemStats[cKey]) champItemStats[cKey] = {};
          if (!champItemStats[cKey][iId])
            champItemStats[cKey][iId] = { games: 0, wins: 0 };
          champItemStats[cKey][iId].games++;
          if (win) champItemStats[cKey][iId].wins++;
        });

        augments.forEach((aId) => {
          if (!stats.augments[aId]) stats.augments[aId] = { games: 0, wins: 0 };
          stats.augments[aId].games++;
          if (win) stats.augments[aId].wins++;
          if (!champAugStats[cKey]) champAugStats[cKey] = {};
          if (!champAugStats[cKey][aId])
            champAugStats[cKey][aId] = { games: 0, wins: 0 };
          champAugStats[cKey][aId].games++;
          if (win) champAugStats[cKey][aId].wins++;
        });

        if (!champGames[cKey]) champGames[cKey] = [];
        champGames[cKey].push({
          win,
          items: finalItems,
          augments,
          orderedBuild,
        });
      }
    });
  });

  return { stats, champGames, champItemStats, champAugStats };
}

//  SGP fetcher
/**
 * Fetches desired games from SGP starting at startIndex, parsing and appending
 * to fullHistory until requestedCount is reached or the API is exhausted.
 *
 * @returns {{ history: Array, oldestStartIndex: number }}
 */
export async function fetchGamesFromSGP(
  puuid,
  requestedCount,
  sgpServer,
  rsoToken,
  fullHistory,
  startIndex,
  onProgress,
) {
  const BATCH_SIZE = 20;
  const MAX_EMPTY_BATCHES = 5;
  let consecutiveEmptyBatches = 0;
  let currentStartIndex = startIndex;
  let oldestAcceptedStartIndex = startIndex;

  while (fullHistory.length < requestedCount) {
    onProgress({
      status: `Fetching batch ${Math.floor(currentStartIndex / BATCH_SIZE) + 1}… Found ${fullHistory.length}/${requestedCount}`,
    });
    const url = `${sgpServer}/match-history-query/v1/products/lol/player/${puuid}/SUMMARY?startIndex=${currentStartIndex}&count=${BATCH_SIZE}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${rsoToken}` },
    });
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
    await new Promise((r) => setTimeout(r, 50));
  }
  return { history: fullHistory, oldestStartIndex: oldestAcceptedStartIndex };
}

//  Core analysis orchestrator
export async function runAnalysis(
  puuid,
  requestedGameCount,
  sgpServer,
  rsoToken,
  onProgress,
) {
  const stats = {
    wins: 0,
    losses: 0,
    remakes: 0,
    champions: {},
    items: {},
    augments: {},
  };
  const BATCH_SIZE = 20;
  const MAX_PROBE_BATCHES = 5;

  const cachedEntry = readCacheEntry(puuid);

  if (!cachedEntry) {
    const result = await fetchGamesFromSGP(
      puuid,
      requestedGameCount,
      sgpServer,
      rsoToken,
      [],
      0,
      onProgress,
    );
    const fullHistory = result.history;
    fullHistory.forEach((e) => accumulateStats(stats, e));
    if (fullHistory.length > 0)
      saveCacheEntry(puuid, fullHistory, result.oldestStartIndex);
    onProgress({ finalStats: stats, fullHistory });
    return;
  }

  let newerGames = [];
  let probeStartIndex = 0;
  let probeBatches = 0;
  let foundBoundary = false;
  while (probeBatches < MAX_PROBE_BATCHES && !foundBoundary) {
    const url = `${sgpServer}/match-history-query/v1/products/lol/player/${puuid}/SUMMARY?startIndex=${probeStartIndex}&count=${BATCH_SIZE}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${rsoToken}` },
    });
    if (!response.ok) break;
    const data = await response.json();
    const batch = data.games || [];
    if (batch.length === 0) break;
    for (const g of batch) {
      const entry = parseGame(g, puuid);
      if (!entry) continue;
      if (entry.gameCreation === cachedEntry.newestGameCreation) {
        foundBoundary = true;
        break;
      }
      newerGames.push(entry);
    }
    if (batch.length < BATCH_SIZE) break;
    probeStartIndex += BATCH_SIZE;
    probeBatches++;
  }

  if (!foundBoundary && newerGames.length > 0) {
    const result = await fetchGamesFromSGP(
      puuid,
      requestedGameCount,
      sgpServer,
      rsoToken,
      [],
      0,
      onProgress,
    );
    const fullHistory = result.history;
    fullHistory.forEach((e) => accumulateStats(stats, e));
    if (fullHistory.length > 0)
      saveCacheEntry(puuid, fullHistory, result.oldestStartIndex);
    onProgress({ finalStats: stats, fullHistory });
    return;
  }

  let mergedHistory = [...newerGames, ...cachedEntry.history];

  if (mergedHistory.length >= requestedGameCount) {
    const slice = mergedHistory.slice(0, requestedGameCount);
    slice.forEach((e) => accumulateStats(stats, e));
    saveCacheEntry(puuid, mergedHistory, cachedEntry.oldestStartIndex);
    onProgress({ finalStats: stats, fullHistory: slice });
    return;
  }

  const result = await fetchGamesFromSGP(
    puuid,
    requestedGameCount,
    sgpServer,
    rsoToken,
    mergedHistory,
    cachedEntry.oldestStartIndex + BATCH_SIZE,
    onProgress,
  );
  mergedHistory = result.history;
  mergedHistory.forEach((e) => accumulateStats(stats, e));
  saveCacheEntry(puuid, mergedHistory, result.oldestStartIndex);
  onProgress({ finalStats: stats, fullHistory: mergedHistory });
}

//  Public entry points
export async function startSelfAnalysis(updateUICallback, requestedGameCount) {
  try {
    updateUICallback({ status: "Connecting to Riot Servers…" });
    const { rso, sgpServer } = await getSgpContext();
    const user = await LCU_API.get("/lol-summoner/v1/current-summoner");
    setMyPuuid(user.puuid);
    await runAnalysis(
      user.puuid,
      requestedGameCount,
      sgpServer,
      rso.token,
      updateUICallback,
    );
  } catch (e) {
    updateUICallback({ error: e.message });
  }
}

export async function startInvestigatorAnalysis(
  updateUICallback,
  riotId,
  requestedGameCount,
) {
  try {
    updateUICallback({ status: `Resolving Riot ID "${riotId}"…` });
    const { rso, sgpServer } = await getSgpContext();
    const { puuid, displayName } = await resolvePuuid(riotId);
    setMyPuuid(puuid);
    updateUICallback({
      status: `Found ${displayName} — fetching Mayhem history…`,
    });
    await runAnalysis(
      puuid,
      requestedGameCount,
      sgpServer,
      rso.token,
      updateUICallback,
    );
  } catch (e) {
    updateUICallback({ error: e.message });
  }
}

export async function getHomeDashboardData() {
  try {
    const settings = await loadSettings();
    const lookback = settings.dashboardLookback || 20;

    const user = await LCU_API.get("/lol-summoner/v1/current-summoner");
    if (!user || !user.puuid) return null;
    const myPuuid = user.puuid;

    const entry = readCacheEntry(myPuuid);
    if (!entry || !entry.history || entry.history.length === 0) return null;

    const historySubset = entry.history.slice(0, lookback);
    const stats = {
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      dmg: 0,
      gold: 0,
      duration: 0,
      kpSum: 0,
    };
    const trend = entry.history.slice(0, 10).map((e) => e.result);
    const uniqueChampSet = new Set();

    historySubset.forEach((e) => {
      if (e.result === "Win") stats.wins++;
      else if (e.result === "Loss") stats.losses++;

      const k = e.kills || 0;
      const a = e.assists || 0;
      stats.kills += k;
      stats.deaths += e.deaths || 0;
      stats.assists += a;
      stats.dmg += e.dmg || 0;
      stats.duration += e.gameDuration || 0;
      uniqueChampSet.add(e.championId);

      const participants = e.rawGame?.json?.participants || [];
      const me = participants.find((p) => p.puuid === myPuuid);
      if (me) {
        stats.gold += me.goldEarned || 0;
        const teamKills = participants
          .filter((p) => p.teamId === me.teamId)
          .reduce((sum, p) => sum + (p.kills || 0), 0);
        if (teamKills > 0) stats.kpSum += (k + a) / teamKills;
      }
    });

    // Calculate Streak
    let streak = 0;
    let streakType = null;
    for (const res of entry.history) {
      if (!streakType) streakType = res.result;
      if (res.result === streakType) streak++;
      else break;
    }

    const champStats = {};
    historySubset.forEach((e) => {
      const cId = e.championId;
      if (!champStats[cId]) champStats[cId] = { id: cId, games: 0, wins: 0 };
      champStats[cId].games++;
      if (e.result === "Win") champStats[cId].wins++;
    });

    const topChamps = Object.values(champStats)
      .sort((a, b) => {
        // Calculate Net Wins (Wins - Losses)
        const netA = a.wins - (a.games - a.wins);
        const netB = b.wins - (b.games - b.wins);

        // Sort by Net Wins (highest first)
        // Tie-break #1: Win Rate
        // Tie-break #2: Games Played
        return (
          netB - netA ||
          b.wins / b.games - a.wins / a.games ||
          b.games - a.games
        );
      })
      .slice(0, 4);

    /* .sort((a, b) => b.games - a.games || (b.wins / b.games) - (a.wins / a.games))
      .slice(0, 4); */

    /* .sort((a, b) => smoothedWinRate(b.wins, b.games) - smoothedWinRate(a.wins, a.games) || b.games - a.games)
      .slice(0, 4); */

    /* .sort((a, b) => (b.wins / b.games) - (a.wins / a.games) || b.games - a.games)
      .slice(0, 4); */

    const allTimeChampStats = {};
    const allTimeDiversitySet = new Set();
    let allTimeDuration = 0;

    entry.history.forEach((e) => {
      const cId = e.championId;
      if (!allTimeChampStats[cId])
        allTimeChampStats[cId] = { id: cId, games: 0, wins: 0 };
      allTimeChampStats[cId].games++;
      if (e.result === "Win") allTimeChampStats[cId].wins++;
      allTimeDiversitySet.add(cId);
      allTimeDuration += e.gameDuration || 0;
    });

    const lifetimeTopChamps = Object.values(allTimeChampStats)
      .sort((a, b) => b.games - a.games || b.wins / b.games - a.wins / a.games)
      .slice(0, 5);

    const gamesCount = stats.wins + stats.losses;
    const totalMinutes = Math.max(1, stats.duration / 60);

    // Format Lifetime Time
    const totalSecs = allTimeDuration;
    const d = Math.floor(totalSecs / 86400);
    const h = Math.floor((totalSecs % 86400) / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const lifetimeTimeStr = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
    const lifetimeAvgLen = (
      allTimeDuration /
      Math.max(1, entry.history.length) /
      60
    ).toFixed(1);

    return {
      wins: stats.wins,
      losses: stats.losses,
      avgKda: `${(stats.kills / Math.max(1, gamesCount)).toFixed(1)}/${(stats.deaths / Math.max(1, gamesCount)).toFixed(1)}/${(stats.assists / Math.max(1, gamesCount)).toFixed(1)}`,
      avgDpm: (stats.dmg / totalMinutes).toFixed(0),
      avgGpm: (stats.gold / totalMinutes).toFixed(0),
      avgKp: ((stats.kpSum / Math.max(1, gamesCount)) * 100).toFixed(0),
      avgDuration: (stats.duration / Math.max(1, gamesCount) / 60).toFixed(1),
      diversity: uniqueChampSet.size,
      streak: `${streak} ${streakType}${streak > 1 ? "s" : ""}`,
      topChamps,
      lifetimeDiversity: allTimeDiversitySet.size,
      lifetimeTopChamps,
      lifetimeTimeStr,
      lifetimeAvgLen,
      trend,
      totalGames: entry.history.length,
      lookback: gamesCount,
      savedAt: entry.savedAt,
    };
  } catch (e) {
    console.error("[MD] Dashboard data fetch failed:", e);
    return null;
  }
}
