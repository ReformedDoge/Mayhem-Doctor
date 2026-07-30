/**
 * Everything that talks to the League Client (LCU) or SGP endpoint.
 * -shared myPuuid state-
 */

import { BOOT_IDS } from './config.js';
import Utils from './generalUtils.js';

// Static game data (at startup) 
export const ITEM_DATA           = {};
export const AUGMENT_DATA        = {};
export const CHAMPION_DATA       = {};
export const SUMMONER_SPELL_DATA = {};

// Current player's PUUID, set by startSelfAnalysis / startInvestigatorAnalysis
// so specific match-view rendering can highlight the ahh "me" row.
export let myPuuid = '';
export function setMyPuuid(puuid) { myPuuid = puuid; }

// Shared LCU fetch wrapper from generalUtils.
export const LCU_API = Utils.LCU;

// Static data loader for lookup and internal asset rendering (Items, Augments, Champions, Summoner spells)
export async function loadStaticData() {
    try {
        const items = await LCU_API.get('/lol-game-data/assets/v1/items.json');
        items.forEach(i => {
            if (!i.id || !i.name) return;
            ITEM_DATA[i.id] = { name: i.name, icon: i.iconPath };

            // Augment BOOT_IDS with any boots not already in the hardcoded seed.
            // No inStore filter - quest/special boots are valid if players can obtain
            // them. If they don't appear in match data they contribute nothing anyway.
            const cats = i.categories || [];
            if (cats.includes('Boots') && i.id !== 1001 && !BOOT_IDS.has(i.id)) {
                BOOT_IDS.add(i.id);
                Utils.Debug.log(`[Mayhem-Doctor] Detected new boot from items.json: ${i.name} (${i.id})`);
            }
        });

        const augs = await LCU_API.get('/lol-game-data/assets/v1/cherry-augments.json');
        augs.forEach(a => { if (a.id && a.id > 0) AUGMENT_DATA[a.id] = { name: a.nameTRA || `Augment ${a.id}`, icon: a.augmentSmallIconPath || a.augmentIconPath, rarity: a.rarity || 'kSilver' }; });

        const champs = await LCU_API.get('/lol-game-data/assets/v1/champion-summary.json');
        champs.forEach(c => { if (c.id !== -1) CHAMPION_DATA[c.id] = c.name; });

        const spells = await LCU_API.get('/lol-game-data/assets/v1/summoner-spells.json');
        spells.forEach(s => { if (s.id) SUMMONER_SPELL_DATA[s.id] = { name: s.name, icon: s.iconPath }; });

    } catch (e) { Utils.Debug.error('[Mayhem-Doctor] Static data load failed:', e); }
}

// Icon helpers
export function getChampionIcon(championId) {
    return `/lol-game-data/assets/v1/champion-icons/${championId}.png`;
}
export function getItemIcon(itemId) {
    return ITEM_DATA[itemId]?.icon || '';
}
export function getSummonerSpellIcon(spellId) {
    return SUMMONER_SPELL_DATA[spellId]?.icon || '';
}

// SGP auth context 
/**
 * Returns { rso, sgpServer } for authenticated SGP requests.
 * Can use ent.accessToken or rso.token, Both works. 
 * /entitlements/v1/token /lol-rso-auth/v1/authorization/access-token
 * Falls back to EUW1 if region detection fails.
 */
export async function getSgpContext() {
    try {
        const { accessToken, sgpBase } = await Utils.GameData.getSgpContext();
        return { rso: { token: accessToken }, sgpServer: sgpBase };
    } catch (err) {
        Utils.Debug.error('Failed to build SGP context:', err);
        return { rso: null, sgpServer: 'https://euc1-red.pp.sgp.pvp.net' };
    }
}

// PUUID resolution 
/** Resolves "GameName#TAG" to { puuid, displayName } via the LCU. */
export async function resolvePuuid(riotId) {
    const encoded = encodeURIComponent(riotId);
    const summoner = await LCU_API.get(`/lol-summoner/v1/summoners?name=${encoded}`);
    if (!summoner || !summoner.puuid) throw new Error(`No PUUID found for "${riotId}".`);
    return { puuid: summoner.puuid, displayName: summoner.displayName || riotId };
}
