/**
 * @name Mayhem-Doctor
 * @version 1.1.0
 * @author SnoozeFest - github@ReformedDoge
 * @description Aram Mayhem Plugin for Pengu Loader.
 * @link https://github.com/ReformedDoge
 * Entry point
 */

import { STYLES } from "./src/assets/styles.js";
import aramIcon from "./src/assets/aram.svg?raw";

import { loadStaticData } from "./src/lcu.js";
import { readCacheIndex, clearAllCache } from "./src/cache.js";
import { openCommandBarModal } from "./src/ui/modal.js";
import {
  injectMatchHistoryButton,
  injectInvestigatorTab,
  INVESTIGATOR_PANEL_ID,
} from "./src/ui/investigator.js";
import { loadSettings, checkForUpdates } from "./src/ui/settings.js";

export async function load() {
  // Inject styles
  const styleEl = document.createElement("style");
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  // Expose clearAllCache so the settings tab renderer can call it without
  // creating a circular import through the UI layer.
  window.__mdCacheRef = { clearAllCache };

  const settings = await loadSettings();
  if (settings.checkUpdates) checkForUpdates();

  await loadStaticData();

  const observer = new MutationObserver(() => {
    if (settings.injectMatchHistoryButton) injectMatchHistoryButton();
    if (settings.injectInvestigatorTab) injectInvestigatorTab();
    
    const panel = document.getElementById(INVESTIGATOR_PANEL_ID);
    if (panel) {
      const modalHasContent = document.querySelector(
        "lol-uikit-full-page-modal .rcp-fe-lol-profiles-modal",
      );
      if (modalHasContent) panel.classList.add("mi-panel-overlay-hidden");
      else panel.classList.remove("mi-panel-overlay-hidden");
    }
  });
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
    name: "Mayhem Doctor — Clear Cache",
    legend: "Wipes all cached match history",
    icon: smallAramIcon,
    tags: ["aram", "mayhem", "cache", "clear", "reset"],
    group: "ARAM",
    perform: () => {
      try {
        const count = clearAllCache();
        Toast.success(
          `Mayhem Doctor: cleared cache for ${count} player${count !== 1 ? "s" : ""}.`,
        );
      } catch (e) {
        Toast.error(`Mayhem Doctor: failed to clear cache — ${e.message}`);
      }
    },
  });

  window.addEventListener("keydown", (e) => {
    if (e.altKey && e.code === "KeyX") {
      e.preventDefault();
      const existing = document.querySelector(".aram-modal-overlay");
      if (existing) existing.remove();
      else openCommandBarModal();
    }
  });

  setTimeout(() => {
    Toast.success("Mayhem Doctor is ready!  •  Press Alt + X to open");
  }, 8000);
}
