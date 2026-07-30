import { getValidQueueIds, Mode } from './mode.js';

/**
 * All plugin-wide constants & Settings
 */

// Feature Toggles
export const ENABLE_GLOBAL_CRAWL = true; // Set to false to hide all crawl UI/logic

const _allQueues = new Set([
    ...getValidQueueIds(Mode.OFFICIAL),
    ...getValidQueueIds(Mode.CLASSIC),
]);
export const VALID_QUEUE_IDS = [..._allQueues];

export const SETTINGS = {
    synergyWeight: 0.3
};

export const BLACKLIST_ITEM_IDS = new Set([
    // Consumables, Potions & Juices
    2003, 2010, 2031, 2033, 2052, 2138, 2139, 2140, 2141, 2142, 2143, 2144, 2145, 2146, 2150, 2151, 2152,
    2161, 2162, 2163, 222141, 220013,

    // Event & Special Items
    550007, 550006, 550005, 550004, 550003, 550002, 550001,

    // Wards, Trinkets & System Noise
    2055, 2056, 3340, 3363, 3364, 1104, 1516, 1517, 1518, 1519, 3330, 3348, 3349, 3398, 3399, 3400, 
    3513, 3599, 3600, 550001, 550002, 550003, 550004, 550005, 550006, 550007, 6032, 220000, 220007,
    6702, 663064, // Veigar Talisman / Scouting Ahead

    // Jungle & Support Starters
    1035, 1039, 1040, 1101, 1102, 1103, 1105, 1106, 1107,
    3865, 3869, 3870, 3871, 3876, 3877, // Support items (Atlas, etc.)

    // Starter Items (ARAM & Normal)
    1054, 1055, 1056, 1082, 1083, 2049, 2050, 2051, 2061, 2062,
    3112, 3177, 3184, 222051, 223112, 223177, 223184, 223185, // Guardian's Items

    // Basic Components (Tier 1)
    1001, 1004, 1006, 1018, 1026, 1027, 1028, 1029, 1033, 1036, 1037, 1038, 1042, 1052, 1057, 1058, 2022, 323070,

    // Mid-Tier Components (Tier 2)
    1011, 1031, 1043, 1053, 2015, 2019, 2020, 2021, 2420, 2421, 2508, 3010, 3012, 3023, 3024, 3035, 
    3051, 3057, 3066, 3067, 3070, 3076, 3077, 3082, 3086, 3098, 3105, 3108, 3113, 3114, 3123, 3133, 
    3134, 3140, 3144, 3145, 3147, 3155, 3191, 3211, 3801, 3802, 3803, 3916, 4003, 4630, 4632, 4638, 4642, 6660, 6670, 6690,
    
    // Boots - all tiers and ARAM variants
    3005, 3006, 3009, 3010, 3017, 3020, 3047, 3111, 3117, 3158, 4001,
    3008, 3013, 3168, 3170, 3171, 3173, 3174, 3175, 3176, 1111,
    223005, 223006, 223008, 223009, 223020, 223047, 223111, 223158,
    
    //Anvil Voucher
    3865,
]);

// Known completed boot item IDs.
// This hardcoded set is the reliable seed - loadStaticData in lcu.js augments it
// dynamically so new boots added by Riot are picked up without a code change.
export const BOOT_IDS = new Set([
    // Standard T2 boots
    3005, 3006, 3009, 3010, 3017, 3020, 3047, 3111, 3117, 3158, 4001,
    // New boots (15.x patches)
    3008,  // Gluttonous Greaves
    3013,  // Synchronized Souls
    3168,  // Immortal Path
    3170,  // Swiftmarch
    3171,  // Crimson Lucidity
    3173,  // Chainlaced Crushers
    3174,  // Armored Advance
    3175,  // Spellslinger's Shoes
    3176,  // Forever Forward
    // ARAM mythic shop variants (223xxx mirrors of standard boots)
    223005, 223006, 223008, 223009, 223020, 223047, 223111, 223158,
    // Special/quest boots (inStore:false but obtainable in Mayhem)
    1111,  // Jarvan I's
    3013,  // Synchronized Souls
    3176,  // Forever Forward
    // Special ARAM-only boots
    2422,  // Slightly Magical Footwear
]);

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

// Cache limits
export const MAX_CACHED_PUUIDS   = 10;
export const MAX_BYTES_PER_PUUID = 6  * 1024 * 1024; // 6 MB per player aka puuid
export const MAX_TOTAL_BYTES     = 60 * 1024 * 1024; // 60 MB total

// Global crawl tuning
export const CRAWL_TARGET_GAMES    = 10_000; // stop when this many unique games collected
export const CRAWL_MAX_PLAYERS     = 1000;    // hard cap on players visited
export const CRAWL_BATCH_SIZE      = 20;     // games fetched per player
export const CRAWL_MAX_CONCURRENT  = 2;      // parallel SGP requests
export const CRAWL_DELAY_MS        = 650;     // ms between individual requests
export const CRAWL_SAVE_EVERY      = 10;     // players between Store state saves
// Cap for in-memory processed game dedupe set. Prune when exceeded.
export const PROCESSED_GAME_IDS_MAX = 200000; // keep up to 100k game IDs in memory
