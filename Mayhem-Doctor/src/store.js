import Utils from "./generalUtils.js";

export { Utils };

export const STORE_MODULES = {
  settings: "mayhemDoctorSettings",
  cache: "mayhemDoctorCache",
  global: "mayhemDoctorGlobal",
  patchFilter: "mayhemDoctorPatchFilter",
};

export const STORE_KEYS = {
  settings: "values",
  cacheIndex: "index",
  globalStats: "stats",
  globalCrawl: "crawl",
  patchExcluded: "excluded",
};

const MIGRATION_VERSION = 1;

const LEGACY_KEYS = {
  settings: "md-settings",
  cacheIndex: "md-cache-index",
  cacheEntryPrefix: "md-cache-",
  globalStats: "md-global-stats",
  globalCrawl: "md-global-crawl",
  globalStatsShardPrefix: "md-global-stats-champ-",
  patchFilter: "md-patch-filter",
};

function hasLegacyStore() {
  return typeof window !== "undefined" && !!window.DataStore;
}

function legacyHas(key) {
  if (!hasLegacyStore()) return false;
  if (typeof window.DataStore.has === "function") return window.DataStore.has(key);
  return window.DataStore.get(key) !== undefined;
}

function legacyGet(key) {
  return legacyHas(key) ? window.DataStore.get(key) : undefined;
}

function legacyRemove(key) {
  if (!hasLegacyStore()) return;
  window.DataStore.remove(key);
}

function storeHas(moduleName, key) {
  try {
    const persisted = window.DataStore?.get?.(Utils.Store.MAIN_KEY);
    if (persisted?.[moduleName]) {
      return Object.prototype.hasOwnProperty.call(persisted[moduleName], key);
    }
    if (window.DataStore?.get) return false;
  } catch {}

  const sentinel = {};
  return Utils.Store.get(moduleName, key, sentinel) !== sentinel;
}

export function storeGet(moduleName, key, fallback) {
  return Utils.Store.get(moduleName, key, fallback);
}

export function storeSet(moduleName, key, value) {
  Utils.Store.set(moduleName, key, value);
  return storeHas(moduleName, key);
}

export function storeRemove(moduleName, key) {
  Utils.Store.remove(moduleName, key);
}

export function getModuleSchemaVersion(moduleName) {
  return storeGet(moduleName, "schemaVersion", 0);
}

function setModuleSchemaVersion(moduleName, version = MIGRATION_VERSION) {
  const current = getModuleSchemaVersion(moduleName);
  if (current < version) storeSet(moduleName, "schemaVersion", version);
}

function migrateLegacyKey(oldKey, moduleName, key, transform = value => value) {
  if (!legacyHas(oldKey)) return false;

  const nextValue = transform(legacyGet(oldKey));
  if (!storeSet(moduleName, key, nextValue)) return false;

  legacyRemove(oldKey);
  return true;
}

function parseMaybeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function migrateSettings() {
  migrateLegacyKey(
    LEGACY_KEYS.settings,
    STORE_MODULES.settings,
    STORE_KEYS.settings,
  );
  setModuleSchemaVersion(STORE_MODULES.settings);
}

function migratePatchFilter() {
  migrateLegacyKey(
    LEGACY_KEYS.patchFilter,
    STORE_MODULES.patchFilter,
    STORE_KEYS.patchExcluded,
    parseMaybeJsonArray,
  );
  setModuleSchemaVersion(STORE_MODULES.patchFilter);
}

function migrateCache() {
  const index = legacyGet(LEGACY_KEYS.cacheIndex);
  const puuids = Array.isArray(index?.puuids) ? index.puuids : [];

  for (const puuid of puuids) {
    const oldEntryKey = `${LEGACY_KEYS.cacheEntryPrefix}${puuid}`;
    migrateLegacyKey(
      oldEntryKey,
      STORE_MODULES.cache,
      `entry:${puuid}`,
    );
  }

  migrateLegacyKey(
    LEGACY_KEYS.cacheIndex,
    STORE_MODULES.cache,
    STORE_KEYS.cacheIndex,
  );
  setModuleSchemaVersion(STORE_MODULES.cache);
}

function collectGlobalStatsShards(stats) {
  if (!stats || stats.v !== 2 || !stats.champions) return [];

  const migratedShards = [];
  for (const [champId, entry] of Object.entries(stats.champions)) {
    const shardKey = `${LEGACY_KEYS.globalStatsShardPrefix}${champId}`;
    if (!legacyHas(shardKey)) continue;

    const shardValue = legacyGet(shardKey);
    if (shardValue !== undefined) entry.g = shardValue;
    migratedShards.push(shardKey);
  }

  if (migratedShards.length) stats.v = 1;
  return migratedShards;
}

function migrateGlobalStats() {
  if (legacyHas(LEGACY_KEYS.globalStats)) {
    const stats = legacyGet(LEGACY_KEYS.globalStats);
    const migratedShards = collectGlobalStatsShards(stats);

    if (storeSet(STORE_MODULES.global, STORE_KEYS.globalStats, stats)) {
      legacyRemove(LEGACY_KEYS.globalStats);
      migratedShards.forEach(legacyRemove);
    }
  }

  migrateLegacyKey(
    LEGACY_KEYS.globalCrawl,
    STORE_MODULES.global,
    STORE_KEYS.globalCrawl,
  );
  setModuleSchemaVersion(STORE_MODULES.global);
}

export function migrateLegacyDatastore() {
  if (!hasLegacyStore()) return;

  try {
    migrateSettings();
    migratePatchFilter();
    migrateCache();
    migrateGlobalStats();
  } catch (error) {
    console.error("[Mayhem-Doctor] DataStore migration failed:", error);
  }
}
