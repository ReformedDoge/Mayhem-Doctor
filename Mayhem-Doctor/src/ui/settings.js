/**
 * Settings: update checker and UI toggle persistence.
 * DataStore key: "md-settings"
 */

const SETTINGS_KEY = "md-settings";
const GITHUB_RELEASES_API =
  "https://api.github.com/repos/ReformedDoge/Mayhem-Doctor/releases/latest";
let CURRENT_VERSION = [1, 0, 0]; // Fallback, will be synced from index.js metadata

const DEFAULT_SETTINGS = {
  injectMatchHistoryButton: true,
  injectInvestigatorTab: true,
  checkUpdates: true,
  dashboardLookback: 20,
  lastAnalysisCount: 50,
};

let _settings = { ...DEFAULT_SETTINGS };
let _latestRelease = null;
let _updatePending = false;
let _badgeCallback = null;

//  Persistence
export async function loadSettings() {
  await syncVersionWithMetadata(); // Sync version from index.js metadata
  try {
    const raw = DataStore.get(SETTINGS_KEY);
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
    DataStore.set(SETTINGS_KEY, _settings);
  } catch {}
}

function setSetting(key, value) {
  _settings[key] = value;
  saveSettings();
}

//  Version helpers
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

//  Version metadata sync
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
        console.log(
          `[Mayhem-Doctor] Version synced from metadata: v${CURRENT_VERSION.join(".")}`,
        );
      }
    }
  } catch (err) {
    console.warn("[Mayhem-Doctor] Failed to sync version from metadata:", err);
  }
}

export function getCurrentVersion() {
  return CURRENT_VERSION.join(".");
}

export function getCurrentVersionArray() {
  return CURRENT_VERSION;
}

//  Update checker
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
    console.warn("[Mayhem-Doctor] Update check failed:", err);
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

//  Settings tab renderer
/**
 * Builds and returns the settings tab content element.
 * Pass a callbacks object to hook into live setting changes:
 *   { onInjectMatchHistory, onInjectInvestigator }
 */
export function renderSettingsTab(callbacks = {}) {
  const root = document.createElement("div");
  root.className = "md-settings-root";

  //  UI Injections section
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
    //selectWrap.style.alignItems = "center";
    selectWrap.style.gap = "8px";

    const select = document.createElement("select");
    select.className = "mi-text-input";
    //select.style.width = "80px";

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

  //  Cache section
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
      const count = clearAllCache ? clearAllCache() : 0;
      clearBtn.textContent = `Cleared (${count} player${count !== 1 ? "s" : ""})`;
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

  //  Updates section
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
                <span class="md-update-banner-text">Update available — v${_latestRelease.version.join(".")}</span>
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

  return root;
}
