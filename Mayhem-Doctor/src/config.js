/**
 * All plugin-wide constants & Settings
 */

// Queue IDs considered valid for analysis (Mayhem = 2400; Normal ARAM = 450 is excluded for now)
export const VALID_QUEUE_IDS    = [2400];
export const BLACKLIST_ITEM_IDS = new Set([2052]); // Poro-Snax

// SGP server endpoints keyed by region code
export const SGP_MAP = {
    TW2:  'https://apse1-red.pp.sgp.pvp.net',
    SG2:  'https://apse1-red.pp.sgp.pvp.net',
    PH2:  'https://apse1-red.pp.sgp.pvp.net',
    VN2:  'https://apse1-red.pp.sgp.pvp.net',
    TH2:  'https://apse1-red.pp.sgp.pvp.net',
    JP1:  'https://apne1-red.pp.sgp.pvp.net',
    KR:   'https://apne1-red.pp.sgp.pvp.net',
    EUW1: 'https://euc1-red.pp.sgp.pvp.net',
    EUN1: 'https://euc1-red.pp.sgp.pvp.net',
    RU:   'https://euc1-red.pp.sgp.pvp.net',
    TR1:  'https://euc1-red.pp.sgp.pvp.net',
    NA1:  'https://usw2-red.pp.sgp.pvp.net',
    BR1:  'https://usw2-red.pp.sgp.pvp.net',
    LA1:  'https://usw2-red.pp.sgp.pvp.net',
    LA2:  'https://usw2-red.pp.sgp.pvp.net',
    OC1:  'https://apse1-red.pp.sgp.pvp.net',
    PBE1: 'https://usw2-red.pp.sgp.pvp.net',
};

// DataStore cache limits
export const CACHE_PREFIX        = 'md-cache-';
export const CACHE_INDEX_KEY     = 'md-cache-index';
export const MAX_CACHED_PUUIDS   = 10;
export const MAX_BYTES_PER_PUUID = 6  * 1024 * 1024; // 6 MB per player aka puuid
export const MAX_TOTAL_BYTES     = 60 * 1024 * 1024; // 60 MB total
