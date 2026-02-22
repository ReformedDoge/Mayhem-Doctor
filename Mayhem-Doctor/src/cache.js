/**
 * DataStore-backed cache per-PUUID match history.
 *
 * Storage layout:
 *   "md-cache-index"    → { puuids: string[], totalBytes: number }
 *   "md-cache-{puuid}"  → { newestGameCreation, oldestGameCreation,
 *                            oldestStartIndex, history, savedAt }
 */

import { CACHE_PREFIX, CACHE_INDEX_KEY, MAX_CACHED_PUUIDS, MAX_BYTES_PER_PUUID, MAX_TOTAL_BYTES } from './config.js';

// Compaction schema 
// The on-disk format uses short keys and arrays instead of verbose field names.
// pack() is called before writing; unpack() restores the full shape the rest
// of the codebase expects. Nothing outside cache.js ever sees the packed form.
//
// History entry short keys:
//   r=result(1/0/-1)  ch=championId  k/d/a=kills/deaths/assists
//   dm=dmg  it=items[]  ob=orderedBuild[]  au=augments[]
//   gc=gameCreation  gd=gameDuration  gv=gameVersion(Major.Minor only)
//   rg=rawGame{ qid, dur, gv, gc, mid, pp:participants[] }
//
// Participant short keys:
//   id=puuid  n=riotIdGameName  tag=riotIdTagline
//   ch=championId  tid=teamId  w=win(1/0)
//   k/d/a  g=gold  cs=totalCS
//   td=dmgToChamps  tph/tmg/ttr=phys/magic/true dmg dealt
//   dtk=dmgTaken  dph/dmg2/dtr=phys/magic/true taken
//   mit=selfMitigated  hl=totalHeal  hlt=healsOnTeammates  sh=shieldOnTeammates
//   fl=flags bitmask(firstBloodKill|firstBloodAssist<<1|firstTowerKill<<2|firstTowerAssist<<3)
//   tt=turretTakedowns  it2=inhibitorTakedowns  sp=[spell1,spell2]
//   it=items[]  au=augments[]  lb=legendaryItemUsed[]

function packParticipant(p) {
    return {
        id:  p.puuid,
        n:   p.riotIdGameName || p.summonerName || '',
        tag: p.riotIdTagline || '',
        ch:  p.championId,
        tid: p.teamId,
        w:   p.win ? 1 : 0,
        k:   p.kills,   d: p.deaths,   a: p.assists,
        g:   p.goldEarned,
        cs:  (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0), // I don't think I care about the speration
        td:  p.totalDamageDealtToChampions,
        tph: p.physicalDamageDealtToChampions,
        tmg: p.magicDamageDealtToChampions,
        ttr: p.trueDamageDealtToChampions,
        dtk: p.totalDamageTaken,
        dph: p.physicalDamageTaken,
        dmg2:p.magicDamageTaken,
        dtr: p.trueDamageTaken,
        mit: p.damageSelfMitigated,
        hl:  p.totalHeal,
        hlt: p.totalHealsOnTeammates,
        sh:  p.totalDamageShieldedOnTeammates,
        fl:  (p.firstBloodKill  ? 1 : 0) | (p.firstBloodAssist  ? 2 : 0) |
             (p.firstTowerKill  ? 4 : 0) | (p.firstTowerAssist  ? 8 : 0),
        tt:  p.turretTakedowns,
        it2: p.inhibitorTakedowns,
        sp:  [p.spell1Id, p.spell2Id],
        it:  [p.item0,p.item1,p.item2,p.item3,p.item4,p.item5,p.item6].filter(x => x),
        au:  [p.playerAugment1,p.playerAugment2,p.playerAugment3,
              p.playerAugment4,p.playerAugment5,p.playerAugment6].filter(x => x),
        lb:  p.challenges?.legendaryItemUsed || []
    };
}

function unpackParticipant(c) {
    const items = c.it || [];
    const augs  = c.au || [];
    return {
        puuid:       c.id,
        riotIdGameName: c.n,
        summonerName:   c.n,
        riotIdTagline:  c.tag,
        championId:  c.ch,
        championName: '',     //Nuked. resolved from static data at render time via getChampionIcon(championId)
        teamId:      c.tid,
        win:         c.w === 1,
        kills: c.k, deaths: c.d, assists: c.a,
        goldEarned:  c.g,
        totalMinionsKilled:  c.cs, neutralMinionsKilled: 0, // cs already combined, Nuked neutralMinionsKilled
        totalDamageDealtToChampions:    c.td,
        physicalDamageDealtToChampions: c.tph,
        magicDamageDealtToChampions:    c.tmg,
        trueDamageDealtToChampions:     c.ttr,
        totalDamageTaken:   c.dtk,
        physicalDamageTaken: c.dph,
        magicDamageTaken:    c.dmg2,
        trueDamageTaken:     c.dtr,
        damageSelfMitigated: c.mit,
        totalHeal:                      c.hl,
        totalHealsOnTeammates:          c.hlt,
        totalDamageShieldedOnTeammates: c.sh,
        firstBloodKill:   !!(c.fl & 1), firstBloodAssist: !!(c.fl & 2),
        firstTowerKill:   !!(c.fl & 4), firstTowerAssist: !!(c.fl & 8),
        turretTakedowns:     c.tt,
        inhibitorTakedowns:  c.it2,
        spell1Id: c.sp?.[0], spell2Id: c.sp?.[1],
        // Restore item0-6
        item0: items[0]||0, item1: items[1]||0, item2: items[2]||0,
        item3: items[3]||0, item4: items[4]||0, item5: items[5]||0, item6: items[6]||0,
        // Restore playerAugment1-6
        playerAugment1: augs[0]||0, playerAugment2: augs[1]||0, playerAugment3: augs[2]||0,
        playerAugment4: augs[3]||0, playerAugment5: augs[4]||0, playerAugment6: augs[5]||0,
        challenges: { legendaryItemUsed: c.lb || [] }
    };
}

function packHistoryEntry(h) {
    const rg = h.rawGame?.json;
    return {
        r:  h.result === 'Win' ? 1 : h.result === 'Loss' ? 0 : -1,
        ch: h.championId,
        k: h.kills, d: h.deaths, a: h.assists,
        dm: h.dmg,
        it: h.items,
        ob: h.orderedBuild,
        au: h.augments,
        gc: h.gameCreation,
        gd: h.gameDuration,
        gv: h.gameVersion?.split('.').slice(0, 2).join('.') || '',
        rg: rg ? {
            qid: rg.queueId,
            dur: rg.gameDuration,
            gv:  rg.gameVersion,
            gc:  rg.gameCreation,
            mid: rg.mapId,
            pp:  rg.participants.map(packParticipant)
        } : null
    };
}

function unpackHistoryEntry(c) {
    const rg = c.rg;
    return {
        result:      c.r === 1 ? 'Win' : c.r === 0 ? 'Loss' : 'Remake',
        championId:  c.ch,
        championName: '',   // resolved via CHAMPION_DATA at render time
        kda:         `${c.k}/${c.d}/${c.a}`,
        kills: c.k, deaths: c.d, assists: c.a,
        dmg:         c.dm,
        items:       c.it || [],
        orderedBuild: c.ob || [],
        augments:    c.au || [],
        gameCreation: c.gc,
        gameDuration: c.gd,
        gameVersion:  c.gv || '',
        rawGame: rg ? {
            json: {
                queueId:      rg.qid,
                gameDuration: rg.dur,
                gameVersion:  rg.gv,
                gameCreation: rg.gc,
                mapId:        rg.mid,
                participants: rg.pp.map(unpackParticipant)
            }
        } : null
    };
}

//  Internal helpers 
function estimateBytes(obj) {
    try { return JSON.stringify(obj).length; } catch { return 0; }
}

function writeCacheIndex(idx) {
    try { DataStore.set(CACHE_INDEX_KEY, { ...idx, v: CACHE_VERSION }); } catch {}
}

function evictUntilFits(idx, neededBytes) {
    while (idx.puuids.length >= MAX_CACHED_PUUIDS) {
        const evictPuuid = idx.puuids.shift();
        const evictEntry = readCacheEntry(evictPuuid);
        const evictBytes = evictEntry ? estimateBytes(evictEntry) : 0;
        try { DataStore.remove(`${CACHE_PREFIX}${evictPuuid}`); } catch {}
        idx.totalBytes = Math.max(0, idx.totalBytes - evictBytes);
    }
    while (idx.puuids.length > 0 && (idx.totalBytes + neededBytes) > MAX_TOTAL_BYTES) {
        const evictPuuid = idx.puuids.shift();
        const evictEntry = readCacheEntry(evictPuuid);
        const evictBytes = evictEntry ? estimateBytes(evictEntry) : 0;
        try { DataStore.remove(`${CACHE_PREFIX}${evictPuuid}`); } catch {}
        idx.totalBytes = Math.max(0, idx.totalBytes - evictBytes);
    }
    return idx;
}

// Cache versioning 
// Bump this any time the on-disk schema changes in a breaking way. (Broken v1 already eksdee)
// On mismatch, all entries are wiped and a fresh index is written —
// analysis.js sees null from readCacheEntry and does a normal full fetch.
const CACHE_VERSION = 2;

function freshIndex() {
    return { v: CACHE_VERSION, puuids: [], totalBytes: 0 };
}

function wipeAllEntries(idx) {
    (idx.puuids || []).forEach(puuid => {
        try { DataStore.remove(`${CACHE_PREFIX}${puuid}`); } catch {}
    });
}

// Public API 
export function readCacheIndex() {
    try {
        const idx = DataStore.get(CACHE_INDEX_KEY);
        if (!idx || !Array.isArray(idx.puuids)) return freshIndex();

        if ((idx.v || 1) < CACHE_VERSION) {
            // Schema changed, wipe stale entries and start clean.
            // analysis.js will do a normal full fetch for any player it looks up.
            console.log(`[MD-Cache] Schema v${idx.v || 1} → v${CACHE_VERSION}: wiping stale cache`);
            wipeAllEntries(idx);
            const clean = freshIndex();
            writeCacheIndex(clean);
            return clean;
        }

        return idx;
    } catch {}
    return freshIndex();
}

export function readCacheEntry(puuid) {
    try {
        const entry = DataStore.get(`${CACHE_PREFIX}${puuid}`);
        if (entry && typeof entry.newestGameCreation === 'number' && Array.isArray(entry.history)) {
            return { ...entry, history: entry.history.map(unpackHistoryEntry) };
        }
    } catch {}
    return null;
}

export function saveCacheEntry(puuid, history, oldestStartIndex) {
    try {
        if (!history || history.length === 0) return;
        const entry = {
            newestGameCreation: history[0].gameCreation,
            oldestGameCreation: history[history.length - 1].gameCreation,
            oldestStartIndex,
            history: history.map(packHistoryEntry),
            savedAt: Date.now()
        };
        const entryBytes = estimateBytes(entry);
        if (entryBytes > MAX_BYTES_PER_PUUID) {
            console.warn(`[MD-Cache] Entry for ${puuid} exceeds per-PUUID limit — not caching`);
            return;
        }
        let idx = readCacheIndex();
        const existingPos = idx.puuids.indexOf(puuid);
        if (existingPos !== -1) {
            const oldEntry = readCacheEntry(puuid);
            idx.totalBytes = Math.max(0, idx.totalBytes - (oldEntry ? estimateBytes(oldEntry) : 0));
            idx.puuids.splice(existingPos, 1);
        }
        idx = evictUntilFits(idx, entryBytes);
        const ok = DataStore.set(`${CACHE_PREFIX}${puuid}`, entry);
        if (!ok) return;
        idx.puuids.push(puuid);
        idx.totalBytes += entryBytes;
        writeCacheIndex(idx);
    } catch (e) {
        console.error('[MD-Cache] saveCacheEntry failed:', e);
    }
}

/** Wipes every cached entry and the index. Returns number of PUUIDs cleared. */
export function clearAllCache() {
    const idx = readCacheIndex();
    idx.puuids.forEach(puuid => {
        try { DataStore.remove(`${CACHE_PREFIX}${puuid}`); } catch {}
    });
    try { DataStore.remove(CACHE_INDEX_KEY); } catch {}
    return idx.puuids.length;
}