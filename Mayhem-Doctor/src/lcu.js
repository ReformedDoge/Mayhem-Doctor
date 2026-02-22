/**
 * Everything that talks to the League Client (LCU) or SGP endpoint.
 * -shared myPuuid state-
 */

import { SGP_MAP } from './config.js';

//  Static game data (at startup) 
export const ITEM_DATA           = {};
export const AUGMENT_DATA        = {};
export const CHAMPION_DATA       = {};
export const SUMMONER_SPELL_DATA = {};

// Current player's PUUID, set by startSelfAnalysis / startInvestigatorAnalysis
// so specific match-view rendering can highlight the ahh "me" row.
export let myPuuid = '';
export function setMyPuuid(puuid) { myPuuid = puuid; }

//  LCU fetch wrapper 
export const LCU_API = {
    get: async (path) => {
        const r = await fetch(path);
        if (!r.ok) throw new Error(`LCU ${r.status}: ${path}`);
        return r.json();
    }
};

//  Static data loader for lookup and internal asset rendering (Items, Augments, Champions, Summoner spells)
export async function loadStaticData() {
    try {
        const items = await LCU_API.get('/lol-game-data/assets/v1/items.json');
        items.forEach(i => { if (i.id && i.name) ITEM_DATA[i.id] = { name: i.name, icon: i.iconPath }; });

        const augs = await LCU_API.get('/lol-game-data/assets/v1/cherry-augments.json');
        augs.forEach(a => { if (a.id && a.id > 0) AUGMENT_DATA[a.id] = { name: a.nameTRA || `Augment ${a.id}`, icon: a.augmentSmallIconPath || a.augmentIconPath, rarity: a.rarity || 'kSilver' }; });

        const champs = await LCU_API.get('/lol-game-data/assets/v1/champion-summary.json');
        champs.forEach(c => { if (c.id !== -1) CHAMPION_DATA[c.id] = c.name; });

        const spells = await LCU_API.get('/lol-game-data/assets/v1/summoner-spells.json');
        spells.forEach(s => { if (s.id) SUMMONER_SPELL_DATA[s.id] = { name: s.name, icon: s.iconPath }; });

    } catch (e) { console.error('[Mayhem-Doctor] Static data load failed:', e); }
}

//  Icon helpers
export function getChampionIcon(championId) {
    return `/lol-game-data/assets/v1/champion-icons/${championId}.png`;
}
export function getItemIcon(itemId) {
    return ITEM_DATA[itemId]?.icon || '';
}
export function getSummonerSpellIcon(spellId) {
    return SUMMONER_SPELL_DATA[spellId]?.icon || '';
}

//  SGP auth context 
/**
 * Returns { rso, sgpServer } for authenticated SGP requests.
 * Can use ent.accessToken or rso.token, Both works. 
 * /entitlements/v1/token /lol-rso-auth/v1/authorization/access-token
 * Falls back to EUW1 if region detection fails.
 */
export async function getSgpContext() {
    try {
        const rsoResponse = await fetch('/lol-rso-auth/v1/authorization/access-token');
        if (!rsoResponse.ok) throw new Error(`RSO token request failed: ${rsoResponse.status}`);
        const rso = await rsoResponse.json();

        const regionResponse = await fetch('/riotclient/region-locale');
        if (!regionResponse.ok) throw new Error(`Region request failed: ${regionResponse.status}`);
        const regionData = await regionResponse.json();
        const rawRegion = (regionData?.region || 'EUW').toUpperCase();

        let sgpServer = SGP_MAP[rawRegion];
        if (!sgpServer) {
            const normalizedRegion = rawRegion.replace(/\d+$/, '');
            const keyMatch = Object.keys(SGP_MAP).find(k => k.startsWith(normalizedRegion));
            sgpServer = keyMatch ? SGP_MAP[keyMatch] : SGP_MAP['EUW1'];
        }
        return { rso, sgpServer };
    } catch (err) {
        console.error('Failed to build SGP context:', err);
        return { rso: null, sgpServer: SGP_MAP['EUW1'] };
    }
}

//  PUUID resolution 
/** Resolves "GameName#TAG" to { puuid, displayName } via the LCU. */
export async function resolvePuuid(riotId) {
    const encoded = encodeURIComponent(riotId);
    const res = await fetch(`/lol-summoner/v1/summoners?name=${encoded}`);
    if (!res.ok) throw new Error(`Could not resolve Riot ID "${riotId}" (${res.status}). Make sure the format is GameName#TAG.`);
    const summoner = await res.json();
    if (!summoner || !summoner.puuid) throw new Error(`No PUUID found for "${riotId}".`);
    return { puuid: summoner.puuid, displayName: summoner.displayName || riotId };
}
