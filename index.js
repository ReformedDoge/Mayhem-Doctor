/**
 * @name Mayhem-Doctor
 * @version 1.2.5
 * @author SnoozeFest - github@ReformedDoge
 * @description Aram Mayhem Plugin for Pengu Loader.
 * @link https://github.com/ReformedDoge
 * Entry point
 */

import { STYLES } from "./src/assets/styles.js";
import aramIcon from "./src/assets/aram.svg?raw";

import { Utils, migrateLegacyDatastore } from "./src/store.js";
import { initResolver } from "./src/resolver.js";
import {
  setFileCacheEnabled,
  isGlobalStatsDirty,
  saveGlobalStatsToFile,
  readGlobalStatsFromFile,
  getExpectedFilePath,
} from "./src/fileCache.js";
import { loadStaticData } from "./src/lcu.js";
import { readCacheIndex, clearAllCache } from "./src/cache.js";
import { clearAllGlobalData, initGlobalFileCache } from "./src/globalCache.js";
import {
  openCommandBarModal,
  hasOpenMayhemWindow,
  closeMayhemWindow,
} from "./src/ui/modal.js";
import {
  injectMatchHistoryButton,
  injectInvestigatorTab,
  INVESTIGATOR_PANEL_ID,
} from "./src/ui/investigator.js";
import {
  loadSettings,
  checkForUpdates,
  getSettings,
} from "./src/ui/settings.js";
import { Mode } from "./src/mode.js";

export async function load(context) {
  initResolver(import.meta.url);
  if (context) Utils.LCU.bind(context);
  migrateLegacyDatastore();

  // Toasts live bottom-right.
  Utils.Toast.setPosition('bottom-right');

  // Hotkey goes live before any modal work so Alt+X works the moment the plugin executes; openCommandBarModal loads its data lazily.
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyX" && e.altKey && !e.ctrlKey &&!e.metaKey) {
      e.preventDefault();
      if (hasOpenMayhemWindow()) closeMayhemWindow();
      else openCommandBarModal();
    }
  });

  // Inject styles
  const styleEl = document.createElement("style");
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  await loadSettings();
  Utils.Debug.setEnabled(getSettings().debugLogs);
  // Run the update check AND the ready toast once the client UI shell is fully loaded (rcp-fe-lol-social is one of the last RCP plugins to boot, so "whenReady" on it is the "client is up" signal).
  // Firing toasts before this point renders them into the boot window, where the shell's startup work / hang can orphan them.
  const runWhenClientReady = (path) => {
    Utils.Debug.log(`[Mayhem-Doctor] Client shell ready: ${path}`);
    if (getSettings().checkUpdates) checkForUpdates();
    Utils.Toast.success("Mayhem Doctor is ready!  •  Press Alt + X to open");
  };
  const rcp = (context && context.rcp) || window.rcp;
  if (rcp && typeof rcp.whenReady === "function") {
    rcp.whenReady("rcp-fe-lol-social").then(
      () => runWhenClientReady("rcp-fe-lol-social ready"),
      () => runWhenClientReady("rcp-fe-lol-social rejected"),
    );
  } else {
    runWhenClientReady("no rcp available (immediate)");
  }

  // Apply file cache setting before loading static data so the flag is ready
  // when initGlobalFileCache fetches the file.
  setFileCacheEnabled(getSettings().useFileGlobalCache);
  await initGlobalFileCache(Mode.OFFICIAL);
  await initGlobalFileCache(Mode.CLASSIC);

  // Expose cache refs for settings UI and dual-mode support
  window.__mdCacheRef = {
    clearAllCache,
    clearAllGlobalData,
    clearAllClassicCache: () => clearAllCache(Mode.CLASSIC),
    clearAllClassicGlobal: () => clearAllGlobalData(Mode.CLASSIC),
    clearOfficialCache: () => clearAllCache(Mode.OFFICIAL),
    clearOfficialGlobal: () => clearAllGlobalData(Mode.OFFICIAL),
  };
  window.__mdFileCacheRef = {
    isGlobalStatsDirty,
    saveGlobalStatsToFile,
    readGlobalStatsFromFile,
    getExpectedFilePath,
    saveToFile: (data, mode) => saveGlobalStatsToFile(data, mode || Mode.OFFICIAL),
    getExpectedPath: (mode) => getExpectedFilePath(mode || Mode.OFFICIAL),
  };

  await loadStaticData();

  const runConfiguredInjections = () => {
    const settings = getSettings();
    if (settings.injectMatchHistoryButton) injectMatchHistoryButton();
    if (settings.injectInvestigatorTab) injectInvestigatorTab();
  };

  const syncInvestigatorPanelOverlay = () => {
    const panel = document.getElementById(INVESTIGATOR_PANEL_ID);
    if (panel) {
      const modalHasContent = document.querySelector(
        "lol-uikit-full-page-modal .rcp-fe-lol-profiles-modal",
      );
      if (modalHasContent) panel.classList.add("mi-panel-overlay-hidden");
      else panel.classList.remove("mi-panel-overlay-hidden");
    }
  };

  Utils.DOM.observer.observe(".match-history-left-title", runConfiguredInjections);
  Utils.DOM.observer.observe(
    "lol-uikit-navigation-bar.style-profile-sub-nav",
    runConfiguredInjections,
  );

  const observer = new MutationObserver(syncInvestigatorPanelOverlay);
  observer.observe(document.body, { childList: true, subtree: true });

  const smallAramIcon = aramIcon
    .replace(/<\?xml.*?\?>/, "")
    .replace(
      "<svg",
      '<svg viewBox="0 0 400 400" style="width:25px;height:25px;min-width:25px;min-height:25px;margin-right:6px;vertical-align:bottom;',
    )
    .replace(/width=".*?"/, "")
    .replace(/height=".*?"/, "");

  CommandBar.addAction({
    id: "mayhem-doctor",
    name: "Mayhem Doctor",
    legend: "Mayhem Match History Analyzer!",
    icon: smallAramIcon,
    tags: [
      "aram",
      "doctor",
      "Analyzer",
      "mayhem",
      "stats",
      "analysis",
      "winrate",
    ],
    group: "ARAM",
    perform: () => openCommandBarModal(),
  });

  CommandBar.addAction({
    id: "mayhem-doctor-clear-cache",
    name: "Mayhem Doctor - Clear Cache",
    legend: "Wipes all cached match history",
    icon: smallAramIcon,
    tags: ["aram", "mayhem", "cache", "clear", "reset"],
    group: "ARAM",
    perform: () => {
      try {
        const official = clearAllCache(Mode.OFFICIAL);
        const classic = clearAllCache(Mode.CLASSIC);
        const total = official + classic;
        Utils.Toast.success(
          `Mayhem Doctor: cleared cache (${official} official, ${classic} classic, ${total} total).`,
        );
      } catch (e) {
        Utils.Toast.error(`Mayhem Doctor: failed to clear cache - ${e.message}`);
      }
    },
  });
}
