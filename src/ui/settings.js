/**
 * Settings: update checker and UI toggle persistence.
 */

import { ENABLE_GLOBAL_CRAWL } from "../config.js";
import { STORE_KEYS, STORE_MODULES, storeGet, storeRemove, storeSet } from "../store.js";
import { Mode, getGlobalStoreModule, getGlobalStatsFile, getGlobalStatsFileName } from "../mode.js";
import Utils from "../generalUtils.js";

const GITHUB_RELEASES_API =
  "https://api.github.com/repos/ReformedDoge/Mayhem-Doctor/releases/latest";
let CURRENT_VERSION = [1, 0, 0]; // Fallback, will be synced from index.js metadata

const DEFAULT_SETTINGS = {
  injectMatchHistoryButton: true,
  injectInvestigatorTab: true,
  openModalInNewWindow: false,
  popoutWindowSize: "standard",
  popoutWindowWidth: 1360,
  popoutWindowHeight: 860,
  popoutWindowZoom: 1.1,
  checkUpdates: true,
  dashboardLookback: 20,
  lastAnalysisCount: 50,

  // Global Crawl (Hidden)
  enableGlobalCrawl: false,

  // Storage
  useFileGlobalCache: false,

  // Crawler Tuning
  crawlTargetGames: 10000,
  crawlMaxPlayers: 600,
  crawlMaxConcurrent: 2,
  crawlDelayMs: 75,
  crawlSaveEvery: 10,

  // Developer
  debugLogs: false,
};

let _settings = { ...DEFAULT_SETTINGS };
let _latestRelease = null;
let _updatePending = false;
let _badgeCallback = null;

// Persistence
export async function loadSettings() {
  await syncVersionWithMetadata(); // Sync version from index.js metadata
  try {
    const raw = storeGet(STORE_MODULES.settings, STORE_KEYS.settings);
    if (raw && typeof raw === "object") {
      _settings = { ...DEFAULT_SETTINGS, ...raw };
    }
  } catch {
    _settings = { ...DEFAULT_SETTINGS };
  }
  return _settings;
}

export function getSettings() {
  return _settings;
}

function saveSettings() {
  try {
    storeSet(STORE_MODULES.settings, STORE_KEYS.settings, _settings);
  } catch {}
}

function setSetting(key, value) {
  _settings[key] = value;
  saveSettings();
}

// Version helpers
function parseVersion(tag) {
  const m = String(tag)
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
}

function isNewer(candidate, current) {
  for (let i = 0; i < 3; i++) {
    if (candidate[i] > current[i]) return true;
    if (candidate[i] < current[i]) return false;
  }
  return false;
}

// Version metadata sync
async function syncVersionWithMetadata() {
  try {
    // Construct URL to index.js relative to this file
    const indexUrl = new URL("../../index.js", import.meta.url);
    const response = await fetch(indexUrl);
    const text = await response.text();

    // Parse @version from metadata header
    const match = text.match(/@version\s+([\d.]+)/);
    if (match && match[1]) {
      const parsed = parseVersion(match[1]);
      if (parsed) {
        CURRENT_VERSION = parsed;
        Utils.Debug.log(`[Mayhem-Doctor] Version synced from metadata: v${CURRENT_VERSION.join(".")}`);
      }
    }
  } catch (err) {
    Utils.Debug.warn("[Mayhem-Doctor] Failed to sync version from metadata:", err);
  }
}

export function getCurrentVersion() {
  return CURRENT_VERSION.join(".");
}

export function getCurrentVersionArray() {
  return CURRENT_VERSION;
}

// Update checker
export async function checkForUpdates(force = false) {
  if (!_settings.checkUpdates && !force) return;
  if (_updatePending) return;
  _updatePending = true;
  try {
    const resp = await fetch(GITHUB_RELEASES_API);
    if (!resp.ok) return;
    const data = await resp.json();
    const latest = parseVersion(data.tag_name || data.name || "");
    if (latest && isNewer(latest, CURRENT_VERSION)) {
      _latestRelease = {
        version: latest,
        url:
          data.html_url ||
          "https://github.com/ReformedDoge/Mayhem-Doctor/releases",
        name: data.name || `v${latest.join(".")}`,
        body: (data.body || "").slice(0, 400),
      };
    } else {
      _latestRelease = null;
    }
    if (_badgeCallback) _badgeCallback(_latestRelease);
  } catch (err) {
    Utils.Debug.warn("[Mayhem-Doctor] Update check failed:", err);
  } finally {
    _updatePending = false;
  }
}

export function getLatestRelease() {
  return _latestRelease;
}
export function setUpdateBadgeCallback(fn) {
  _badgeCallback = fn;
}
export function hasUpdate() {
  return _latestRelease !== null;
}

export function updateSetting(key, value) {
  setSetting(key, value);
}

// Settings tab renderer
/**
 * Builds and returns the settings tab content element.
 * Pass a callbacks object to hook into live setting changes:
 *   { onInjectMatchHistory, onInjectInvestigator }
 */
export function renderSettingsTab(callbacks = {}) {
  const root = document.createElement("div");
  root.className = "md-settings-root";

  // UI Injections section
  const uiTitle = document.createElement("h3");
  uiTitle.className = "md-settings-section-title";
  uiTitle.textContent = "UI Injections";
  root.appendChild(uiTitle);

  const uiNote = document.createElement("p");
  uiNote.className = "md-settings-note";
  uiNote.textContent =
    "Changes take effect after the relevant page is next loaded by the client.";
  root.appendChild(uiNote);

  function makeToggle(label, description, settingKey, onChanged) {
    const row = document.createElement("div");
    row.className = "md-settings-row";

    const textWrap = document.createElement("div");
    textWrap.className = "md-settings-row-text";

    const lbl = document.createElement("div");
    lbl.className = "md-settings-row-label";
    lbl.textContent = label;

    const desc = document.createElement("div");
    desc.className = "md-settings-row-desc";
    desc.textContent = description;

    textWrap.appendChild(lbl);
    textWrap.appendChild(desc);

    const toggle = document.createElement("label");
    toggle.className = "md-toggle";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = _settings[settingKey];
    cb.onchange = () => {
      setSetting(settingKey, cb.checked);
      if (onChanged) onChanged(cb.checked);
    };

    const slider = document.createElement("span");
    slider.className = "md-toggle-slider";

    toggle.appendChild(cb);
    toggle.appendChild(slider);
    row.appendChild(textWrap);
    row.appendChild(toggle);
    return row;
  }

  function makeNumberSetting(label, description, settingKey, min, max, step = 1) {
    const row = document.createElement("div");
    row.className = "md-settings-row";

    const textWrap = document.createElement("div");
    textWrap.className = "md-settings-row-text";

    const lbl = document.createElement("div");
    lbl.className = "md-settings-row-label";
    lbl.textContent = label;

    const desc = document.createElement("div");
    desc.className = "md-settings-row-desc";
    desc.textContent = description;

    textWrap.appendChild(lbl);
    textWrap.appendChild(desc);

    const input = document.createElement("input");
    input.type = "number";
    input.className = "aram-number-input";
    input.style.width = "80px";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = _settings[settingKey];
    input.onchange = () => {
      let val = parseInt(input.value);
      if (isNaN(val)) val = DEFAULT_SETTINGS[settingKey];
      val = Math.min(max, Math.max(min, val));
      input.value = val;
      setSetting(settingKey, val);
    };

    row.appendChild(textWrap);
    row.appendChild(input);
    return row;
  }

  function normalisePopupDimension(value, fallback, min, max) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function makeWindowSizeControl() {
    const settingKey = "popoutWindowSize";
    const row = document.createElement("div");
    row.className = "md-settings-row";

    const textWrap = document.createElement("div");
    textWrap.className = "md-settings-row-text";

    const lbl = document.createElement("div");
    lbl.className = "md-settings-row-label";
    lbl.textContent = "Window size";

    const desc = document.createElement("div");
    desc.className = "md-settings-row-desc";
    desc.textContent = "Sets the default size for the pop out window.";

    textWrap.appendChild(lbl);
    textWrap.appendChild(desc);

    const controlWrap = document.createElement("div");
    controlWrap.className = "md-settings-control-row";

    const select = document.createElement("select");
    select.className = "mi-text-input";
    select.classList.add("md-settings-window-select");

    const options = [
      { label: "Compact (1170 x 770)", value: "compact" },
      { label: "Standard (1360 x 860)", value: "standard" },
      { label: "Large (1440 x 900)", value: "large" },
      { label: "Custom", value: "custom" },
    ];

    options.forEach((opt) => {
      const optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      optionEl.selected = _settings[settingKey] === opt.value;
      select.appendChild(optionEl);
    });

    if (!options.some((opt) => opt.value === _settings[settingKey])) {
      _settings[settingKey] = "standard";
    }

    select.value = _settings[settingKey];

    const widthInput = document.createElement("input");
    widthInput.type = "number";
    widthInput.className = "aram-number-input md-settings-dim-input";
    widthInput.min = "800";
    widthInput.max = "3840";
    widthInput.value = normalisePopupDimension(
      _settings.popoutWindowWidth,
      1360,
      800,
      3840,
    );

    const separator = document.createElement("span");
    separator.className = "md-settings-dim-sep";
    separator.textContent = "x";

    const heightInput = document.createElement("input");
    heightInput.type = "number";
    heightInput.className = "aram-number-input md-settings-dim-input";
    heightInput.min = "600";
    heightInput.max = "2160";
    heightInput.value = normalisePopupDimension(
      _settings.popoutWindowHeight,
      800,
      600,
      2160,
    );

    const syncCustomState = () => {
      const isCustom = select.value === "custom";
      widthInput.style.display = isCustom ? "" : "none";
      heightInput.style.display = isCustom ? "" : "none";
      separator.style.display = isCustom ? "" : "none";
    };

    select.onchange = () => {
      setSetting(settingKey, select.value);
      syncCustomState();
    };

    widthInput.onchange = () => {
      const value = normalisePopupDimension(widthInput.value, 1360, 800, 3840);
      widthInput.value = value;
      setSetting("popoutWindowWidth", value);
    };

    heightInput.onchange = () => {
      const value = normalisePopupDimension(heightInput.value, 800, 600, 2160);
      heightInput.value = value;
      setSetting("popoutWindowHeight", value);
    };

    syncCustomState();

    window.addEventListener("md-settings-sync-window", () => {
      select.value = _settings.popoutWindowSize || "standard";
      widthInput.value = _settings.popoutWindowWidth || 1360;
      heightInput.value = _settings.popoutWindowHeight || 860;
      syncCustomState();
    });

    controlWrap.appendChild(select);
    controlWrap.appendChild(widthInput);
    controlWrap.appendChild(separator);
    controlWrap.appendChild(heightInput);

    row.appendChild(textWrap);
    row.appendChild(controlWrap);
    return { row, select, widthInput, heightInput };
  }

  function setWindowSizeControlDisabled(control, disabled) {
    control.row.classList.toggle("md-settings-row-disabled", disabled);
    control.select.disabled = disabled;
    control.widthInput.disabled = disabled;
    control.heightInput.disabled = disabled;
  }

  root.appendChild(
    makeToggle(
      "Match History Button",
      "Injects the Mayhem! run button on your match history page.",
      "injectMatchHistoryButton",
      callbacks.onInjectMatchHistory,
    ),
  );

  root.appendChild(
    makeToggle(
      "Profile Investigator Tab",
      "Injects the Mayhem Investigator tab on the profile page.",
      "injectInvestigatorTab",
      callbacks.onInjectInvestigator,
    ),
  );

  const windowTitle = document.createElement("h3");
  windowTitle.className = "md-settings-section-title";
  windowTitle.textContent = "Window behavior";
  root.appendChild(windowTitle);

  function makeWindowZoomControl() {
    const settingKey = "popoutWindowZoom";
    const row = document.createElement("div");
    row.className = "md-settings-row";

    const textWrap = document.createElement("div");
    textWrap.className = "md-settings-row-text";

    const lbl = document.createElement("div");
    lbl.className = "md-settings-row-label";
    lbl.textContent = "Window zoom";

    const desc = document.createElement("div");
    desc.className = "md-settings-row-desc";
    desc.textContent = "Adjusts the scale of the pop out window content.";

    textWrap.appendChild(lbl);
    textWrap.appendChild(desc);

    const controlWrap = document.createElement("div");
    controlWrap.className = "md-settings-control-row";

    const zoomInput = document.createElement("input");
    zoomInput.type = "number";
    zoomInput.className = "aram-number-input md-settings-dim-input";
    zoomInput.min = "0.5";
    zoomInput.max = "2.5";
    zoomInput.step = "0.1";
    zoomInput.value = _settings[settingKey] || 1.1;

    zoomInput.onchange = () => {
      let value = parseFloat(zoomInput.value);
      if (isNaN(value)) value = 1.1;
      value = Math.max(0.5, Math.min(2.5, value));
      zoomInput.value = value.toFixed(1);
      setSetting(settingKey, value);
    };

    window.addEventListener("md-settings-sync-window", () => {
      zoomInput.value = _settings[settingKey] || 1.1;
    });

    controlWrap.appendChild(zoomInput);
    row.appendChild(textWrap);
    row.appendChild(controlWrap);

    return { row, zoomInput };
  }

  function setWindowZoomControlDisabled(control, disabled) {
    control.row.classList.toggle("md-settings-row-disabled", disabled);
    control.zoomInput.disabled = disabled;
  }

  const windowSizeControl = makeWindowSizeControl();
  const windowZoomControl = makeWindowZoomControl();

  const popoutToggle = makeToggle(
    "Pop out window",
    "Opens in a separate window instead of an in-client modal.",
    "openModalInNewWindow",
    (enabled) => {
      setWindowSizeControlDisabled(windowSizeControl, !enabled);
      setWindowZoomControlDisabled(windowZoomControl, !enabled);
    }
  );
  root.appendChild(popoutToggle);

  root.appendChild(windowSizeControl.row);
  root.appendChild(windowZoomControl.row);
  setWindowSizeControlDisabled(windowSizeControl, !_settings.openModalInNewWindow);
  setWindowZoomControlDisabled(windowZoomControl, !_settings.openModalInNewWindow);

  // Dashboard Settings
  const dashTitle = document.createElement("h3");
  dashTitle.className = "md-settings-section-title";
  dashTitle.textContent = "Home Dashboard";
  root.appendChild(dashTitle);

  function makeSelect(label, description, settingKey, options) {
    const row = document.createElement("div");
    row.className = "md-settings-row";
    const textWrap = document.createElement("div");
    textWrap.className = "md-settings-row-text";
    const lbl = document.createElement("div");
    lbl.className = "md-settings-row-label";
    lbl.textContent = label;
    const desc = document.createElement("div");
    desc.className = "md-settings-row-desc";
    desc.textContent = description;
    textWrap.appendChild(lbl);
    textWrap.appendChild(desc);

    const selectWrap = document.createElement("div");
    selectWrap.style.display = "flex";
    selectWrap.style.gap = "8px";

    const select = document.createElement("select");
    select.className = "mi-text-input";

    const customInput = document.createElement("input");
    customInput.type = "number";
    customInput.className = "aram-number-input";
    customInput.style.width = "60px";
    customInput.style.display = "none";

    const isStandard = options.some(
      (opt) => opt.value === _settings[settingKey],
    );

    options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      o.selected = _settings[settingKey] === opt.value;
      select.appendChild(o);
    });

    const customOpt = document.createElement("option");
    customOpt.value = "custom";
    customOpt.textContent = "Custom";
    customOpt.selected = !isStandard;
    select.appendChild(customOpt);

    if (!isStandard) {
      customInput.style.display = "block";
      customInput.value = _settings[settingKey];
    }

    select.onchange = () => {
      if (select.value === "custom") {
        customInput.style.display = "block";
        customInput.value = _settings[settingKey] || 20;
        setSetting(settingKey, parseInt(customInput.value));
      } else {
        customInput.style.display = "none";
        setSetting(settingKey, parseInt(select.value) || select.value);
      }
    };

    customInput.oninput = () => {
      const val = Math.max(1, parseInt(customInput.value) || 1);
      setSetting(settingKey, val);
    };

    selectWrap.appendChild(select);
    selectWrap.appendChild(customInput);
    row.appendChild(textWrap);
    row.appendChild(selectWrap);
    return row;
  }

  root.appendChild(
    makeSelect(
      "Dashboard Lookback",
      "The number of recent games used to calculate your home screen stats.",
      "dashboardLookback",
      [
        { label: "10 Games", value: 10 },
        { label: "20 Games", value: 20 },
        { label: "50 Games", value: 50 },
        { label: "100 Games", value: 100 },
        { label: "All", value: 9999 },
      ],
    ),
  );

  // Storage section (visible when global crawl is unlocked)
  if (_settings.enableGlobalCrawl) {
    const storageTitle = document.createElement("h3");
    storageTitle.className = "md-settings-section-title";
    storageTitle.textContent = "Storage";
    root.appendChild(storageTitle);

    const storageNote = document.createElement("p");
    storageNote.className = "md-settings-note";
    storageNote.style.cssText = "font-size:12px; color:#888; margin:0 0 10px; line-height:1.5;";
    storageNote.innerHTML =
      "Pengu Loader serializes the entire DataStore on every write. Keeping the 50-100+ MB global stats blob in DataStore causes lag whenever <i>any</i> plugin updates its settings.<br><br>" +
      "<span style=\"color:#c8aa6e; font-weight:bold;\">Performance Tip:</span> If you experience client stuttering or degraded performance, enable File Cache and perform a <b>Data Migration</b>. The redundant DataStore copy will be removed automatically once you successfully save the file.";

      //"<span style=\"color:#c8aa6e; font-weight:bold;\">Performance Tip:</span> If you experience client stuttering or degraded performance, enable File Cache, perform a <b>Data Migration</b>, and then use <b>'Clear Global Data'</b> in the section below to wipe the redundant DataStore copy.";
    root.appendChild(storageNote);

    root.appendChild(
      makeToggle(
        "Global stats file cache",
        "Store md-global-stats in data/md-global-stats.json instead of DataStore. " +
        "Requires saving the file after each crawl. No restart needed.",
        "useFileGlobalCache",
        async (enabled) => {
            try {
                const { setFileCacheEnabled } = await import("../fileCache.js");
                setFileCacheEnabled(enabled);
                const { reloadCacheMode } = await import("../globalCache.js");
                await reloadCacheMode(enabled, Mode.OFFICIAL);
                await reloadCacheMode(enabled, Mode.CLASSIC);
                window.dispatchEvent(new Event("md-cache-reloaded"));
            } catch (e) {
                Utils.Debug.error("[MD-Settings] Error seamlessly toggling cache mode:", e);
            }
        }
      ),
    );

    const fileCacheNote = document.createElement("div");
    fileCacheNote.className = "md-settings-row";
    fileCacheNote.style.cssText = "flex-direction:column; align-items:flex-start; gap:6px;";

    const fileCacheDesc = document.createElement("div");
    fileCacheDesc.className = "md-settings-row-desc";
    fileCacheDesc.style.cssText = "font-size:11px; color:#666; line-height:1.6;";

    const { getExpectedPath } = window.__mdFileCacheRef || {};
    function fmtPath(mode) {
      let p = getExpectedPath ? getExpectedPath(mode) : "data/md-global-stats.json";
      if (p.includes("https://plugins/")) {
        p = p.replace("https://plugins/", "Pengu Loader\\plugins\\").replace(/\//g, "\\");
      } else {
        p = "Pengu Loader\\plugins\\Mayhem-Doctor\\data\\" + (mode === Mode.OFFICIAL ? "md-global-stats.json" : "classic-md-global-stats.json");
      }
      return p;
    }

    fileCacheDesc.innerHTML =
      `When saving after a crawl, save the file to your plugin's data\\ folder so it loads automatically on startup.<br>` +
      `<b>Official:</b> <code style="color:#c8aa6e; font-size:10px;">...\\${fmtPath(Mode.OFFICIAL)}</code><br>` +
      `<b>Classic:</b> <code style="color:#c8aa6e; font-size:10px;">...\\${fmtPath(Mode.CLASSIC)}</code>`;

    fileCacheNote.appendChild(fileCacheDesc);
    root.appendChild(fileCacheNote);

    function createMigrateBtn(mode, fromStore, toStore, text, successMsg) {
      const btn = document.createElement("button");
      btn.className = "aram-btn-start";
      btn.textContent = text;
      btn.style.cssText = "white-space: nowrap;";

      if (fromStore) {
        btn.onclick = async () => {
          btn.disabled = true;
          btn.textContent = "Migrating " + (mode === Mode.OFFICIAL ? "Official" : "Classic") + "...";
          try {
            const storeMod = getGlobalStoreModule(mode);
            const stats = storeGet(storeMod, STORE_KEYS.globalStats);
            const crawl = storeGet(storeMod, STORE_KEYS.globalCrawl);

            if (!stats && !crawl) {
              btn.textContent = "Nothing to migrate";
              setTimeout(() => { btn.disabled = false; btn.textContent = text; }, 3000);
              return;
            }

            const payload = stats || { v: 1, savedAt: Date.now(), totalGames: 0, visitedCount: 0, champions: {} };
            if (crawl) payload.crawl = crawl;

            const { saveGlobalStatsToFile } = window.__mdFileCacheRef || {};
            if (saveGlobalStatsToFile) {
              const ok = await saveGlobalStatsToFile(payload, mode);
              if (ok) {
                storeRemove(storeMod, STORE_KEYS.globalStats);
                storeRemove(storeMod, STORE_KEYS.globalCrawl);
                btn.textContent = "Complete!";
                if (typeof Toast !== 'undefined') Toast.success(successMsg);
                window.dispatchEvent(new Event("md-cache-reloaded"));
              } else {
                btn.textContent = "Cancelled";
              }
            } else {
              btn.textContent = "Error: File module not ready";
            }
          } catch (err) {
            btn.textContent = "Failed";
            Utils.Debug.error(err);
          }
          setTimeout(() => { btn.disabled = false; btn.textContent = text; }, 3000);
        };
      } else {
        btn.onclick = async () => {
          btn.disabled = true;
          btn.textContent = "Migrating " + (mode === Mode.OFFICIAL ? "Official" : "Classic") + "...";
          try {
            const { readGlobalStatsFromFile } = window.__mdFileCacheRef || {};
            if (!readGlobalStatsFromFile) {
              btn.textContent = "Error: File module not ready";
              setTimeout(() => { btn.disabled = false; btn.textContent = text; }, 3000);
              return;
            }

            const fileData = await readGlobalStatsFromFile(mode);
            if (!fileData) {
              btn.textContent = "No file found";
              setTimeout(() => { btn.disabled = false; btn.textContent = text; }, 3000);
              return;
            }

            const crawl = fileData.crawl || null;
            delete fileData.crawl;

            const storeMod = getGlobalStoreModule(mode);
            storeSet(storeMod, STORE_KEYS.globalStats, fileData);
            if (crawl) storeSet(storeMod, STORE_KEYS.globalCrawl, crawl);

            btn.textContent = "Complete!";
            if (typeof Toast !== 'undefined') Toast.success(successMsg);
            window.dispatchEvent(new Event("md-cache-reloaded"));
          } catch (err) {
            btn.textContent = "Failed";
            Utils.Debug.error(err);
          }
          setTimeout(() => { btn.disabled = false; btn.textContent = text; }, 3000);
        };
      }

      return btn;
    }

    const modes = [Mode.OFFICIAL, Mode.CLASSIC];
    const modeLabels = { [Mode.OFFICIAL]: "Official", [Mode.CLASSIC]: "Classic" };

    for (const mode of modes) {
      const migrateRow = document.createElement("div");
      migrateRow.className = "md-settings-row";
      migrateRow.style.cssText = "flex-direction: row; gap: 10px; border-top: none; padding-top: 5px;";

      const label = document.createElement("span");
      label.style.cssText = "font-size:11px; font-weight:bold; color:#c8aa6e; min-width:60px; align-self:center;";
      label.textContent = modeLabels[mode] + ":";

      migrateRow.appendChild(label);

      const btnGroup = document.createElement("div");
      btnGroup.style.cssText = "display:flex; gap:10px;";

      const toFileBtn = createMigrateBtn(
        mode, true, false,
        "DataStore \u2192 File",
        "Migrated " + modeLabels[mode] + " to file! File Cache must be enabled to use it."
      );
      btnGroup.appendChild(toFileBtn);

      const toStoreBtn = createMigrateBtn(
        mode, false, true,
        "File \u2192 DataStore",
        "Migrated " + modeLabels[mode] + " file to DataStore. You can now disable File Cache."
      );
      btnGroup.appendChild(toStoreBtn);

      migrateRow.appendChild(btnGroup);

      root.appendChild(migrateRow);
    }
  }

  // Global Champion Data section
  const globalCacheTitle = document.createElement("h3");
  globalCacheTitle.className = "md-settings-section-title";
  globalCacheTitle.textContent = "Global Champion Data";
  root.appendChild(globalCacheTitle);

  const globalCacheRow = document.createElement("div");
  globalCacheRow.className = "md-settings-row";

  const globalCacheText = document.createElement("div");
  globalCacheText.className = "md-settings-row-text";

  const globalCacheLbl = document.createElement("div");
  globalCacheLbl.className = "md-settings-row-label";
  globalCacheLbl.textContent = "Crawl data";

  const globalCacheDesc = document.createElement("div");
  globalCacheDesc.className = "md-settings-row-desc";
  globalCacheDesc.textContent =
    "Clears aggregated champion stats and crawl state from the Global Champions tab. Does not affect your personal match history cache.";

  globalCacheText.appendChild(globalCacheLbl);
  globalCacheText.appendChild(globalCacheDesc);

  const clearGlobalBtn = document.createElement("button");
  clearGlobalBtn.className = "aram-btn-start";
  clearGlobalBtn.textContent = "Clear Global Data";
  clearGlobalBtn.style.cssText = "white-space:nowrap;";
  clearGlobalBtn.onclick = () => {
    try {
      const { clearAllGlobalData } = window.__mdCacheRef || {};
      const hadOfficial = clearAllGlobalData ? clearAllGlobalData(Mode.OFFICIAL) : false;
      const hadClassic = clearAllGlobalData ? clearAllGlobalData(Mode.CLASSIC) : false;
      const had = hadOfficial || hadClassic;
      clearGlobalBtn.textContent = had ? "Cleared both!" : "Nothing to clear";
      clearGlobalBtn.disabled = true;
      window.dispatchEvent(new Event("md-cache-reloaded"));
      setTimeout(() => {
        clearGlobalBtn.textContent = "Clear Global Data";
        clearGlobalBtn.disabled = false;
      }, 3000);
    } catch (e) {
      clearGlobalBtn.textContent = "Failed";
      setTimeout(() => {
        clearGlobalBtn.textContent = "Clear Global Data";
      }, 2000);
    }
  };

  globalCacheRow.appendChild(globalCacheText);
  globalCacheRow.appendChild(clearGlobalBtn);
  root.appendChild(globalCacheRow);

  // Cache section
  const cacheTitle = document.createElement("h3");
  cacheTitle.className = "md-settings-section-title";
  cacheTitle.textContent = "Cache";
  root.appendChild(cacheTitle);

  const cacheRow = document.createElement("div");
  cacheRow.className = "md-settings-row";

  const cacheText = document.createElement("div");
  cacheText.className = "md-settings-row-text";

  const cacheLbl = document.createElement("div");
  cacheLbl.className = "md-settings-row-label";
  cacheLbl.textContent = "Cached match data";

  const cacheDesc = document.createElement("div");
  cacheDesc.className = "md-settings-row-desc";
  cacheDesc.textContent =
    "Clears all locally stored match history. Next analysis will re-fetch from Riot servers.";

  cacheText.appendChild(cacheLbl);
  cacheText.appendChild(cacheDesc);

  const clearBtn = document.createElement("button");
  clearBtn.className = "aram-btn-start";
  clearBtn.textContent = "Clear Cache";
  clearBtn.style.cssText = "white-space:nowrap;";
  clearBtn.onclick = () => {
    try {
      const { clearAllCache } = window.__mdCacheRef || {};
      const countOfficial = clearAllCache ? clearAllCache(Mode.OFFICIAL) : 0;
      const countClassic = clearAllCache ? clearAllCache(Mode.CLASSIC) : 0;
      const total = countOfficial + countClassic;
      clearBtn.textContent = total > 0 ? `Cleared (${total} player${total !== 1 ? "s" : ""})` : "Nothing to clear";
      clearBtn.disabled = true;
      setTimeout(() => {
        clearBtn.textContent = "Clear Cache";
        clearBtn.disabled = false;
      }, 3000);
    } catch (e) {
      clearBtn.textContent = "Failed";
      setTimeout(() => {
        clearBtn.textContent = "Clear Cache";
      }, 2000);
    }
  };

  cacheRow.appendChild(cacheText);
  cacheRow.appendChild(clearBtn);
  root.appendChild(cacheRow);

  // Crawler Tuning (Hidden unless unlocked)
  if (_settings.enableGlobalCrawl) {
    const crawlTitle = document.createElement("h3");
    crawlTitle.className = "md-settings-section-title";
    crawlTitle.textContent = "Crawler Tuning";
    root.appendChild(crawlTitle);

    root.appendChild(
      makeNumberSetting(
        "Target Games",
        "Stop crawling once this many unique games are collected.",
        "crawlTargetGames",
        100,
        500000,
        100,
      ),
    );

    root.appendChild(
      makeNumberSetting(
        "Max Players",
        "Hard cap on the number of unique players to visit per session.",
        "crawlMaxPlayers",
        10,
        50000,
        10,
      ),
    );

    root.appendChild(
      makeNumberSetting(
        "Concurrency",
        "Number of parallel requests to the Riot SGP server.",
        "crawlMaxConcurrent",
        1,
        10,
      ),
    );

    root.appendChild(
      makeNumberSetting(
        "Request Delay (ms)",
        "Minimum delay between individual match-list requests.",
        "crawlDelayMs",
        0,
        2000,
        5,
      ),
    );
  }

  // Updates section
  const updateTitle = document.createElement("h3");
  updateTitle.className = "md-settings-section-title";
  updateTitle.textContent = "Updates";
  root.appendChild(updateTitle);

  root.appendChild(
    makeToggle(
      "Check for updates on startup",
      "Fetches the latest release from GitHub when the plugin loads.",
      "checkUpdates",
      null,
    ),
  );

  const updateStatusEl = document.createElement("div");
  updateStatusEl.className = "md-settings-update-status";

  function renderUpdateStatus() {
    updateStatusEl.innerHTML = "";
    if (_latestRelease) {
      const banner = document.createElement("div");
      banner.className = "md-update-banner";
      banner.innerHTML = `
                <span class="md-update-banner-text">Update available - v${_latestRelease.version.join(".")}</span>
                <a class="aram-btn-start md-update-link" href="${_latestRelease.url}" target="_blank">View release</a>
            `;
      updateStatusEl.appendChild(banner);
    }
  }

  _badgeCallback = (release) => {
    _latestRelease = release;
    renderUpdateStatus();
  };
  renderUpdateStatus();
  root.appendChild(updateStatusEl);

  const checkRow = document.createElement("div");
  checkRow.className = "md-settings-row";
  checkRow.style.marginTop = "8px";

  const checkBtn = document.createElement("button");
  checkBtn.className = "aram-btn-start";
  checkBtn.textContent = "Check now";
  checkBtn.style.cssText = "font-size:11px;padding:5px 14px;";

  const checkStatus = document.createElement("span");
  checkStatus.className = "md-settings-check-status";

  checkBtn.onclick = async () => {
    checkBtn.disabled = true;
    checkBtn.textContent = "Checking…";
    checkStatus.textContent = "";
    await checkForUpdates(true);
    renderUpdateStatus();
    checkBtn.disabled = false;
    checkBtn.textContent = "Check now";
    checkStatus.textContent = _latestRelease ? "" : "Already up to date";
    setTimeout(() => {
      checkStatus.textContent = "";
    }, 3000);
  };

  checkRow.appendChild(checkBtn);
  checkRow.appendChild(checkStatus);
  root.appendChild(checkRow);

  // Developer section
  const devTitle = document.createElement("h3");
  devTitle.className = "md-settings-section-title";
  devTitle.textContent = "Developer";
  root.appendChild(devTitle);

  root.appendChild(
    makeToggle(
      "Enable debug logs",
      "Logs detailed Mayhem Doctor debug info to the browser console. Disable unless troubleshooting.",
      "debugLogs",
      (enabled) => Utils.Debug.setEnabled(enabled),
    ),
  );

  return root;
}
