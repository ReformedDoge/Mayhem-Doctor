/**
 * Modal overlay factory and the commandBar action activation modal (Alt+X).
 */

import { STYLES } from "../assets/styles.js";
import {
  startSelfAnalysis,
  startInvestigatorAnalysis,
  getHomeDashboardData,
} from "../analysis.js";
import { renderStatsInto } from "./tabs.js";
import {
  getCurrentVersion,
  hasUpdate,
  loadSettings,
  updateSetting,
  getSettings,
} from "./settings.js";

const POPUP_WINDOW_NAME = "mayhemDoctorPopout";
const POPUP_WINDOW_STYLES = `
body.aram-popout-body {
    margin: 0;
    overflow: hidden;
    background: #010a13;
}

.aram-popout-window {
    height: 100vh;
    padding: 16px;
    box-sizing: border-box;
}

.aram-popout-window .aram-modal-content {
    width: 100%;
    max-width: none;
    height: 100%;
    box-sizing: border-box;
}
`;

let popupWindowRef = null;

const POPUP_SIZE_PRESETS = {
  compact: { width: 1170, height: 770 },
  standard: { width: 1360, height: 860 },
  large: { width: 1440, height: 900 },
};

function clampPopupDimension(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getPopupWindow() {
  if (popupWindowRef && popupWindowRef.closed) popupWindowRef = null;
  return popupWindowRef;
}

function closePopupWindow() {
  const existing = getPopupWindow();
  if (!existing) return;
  try {
    existing.close();
  } catch {}
  if (popupWindowRef === existing) popupWindowRef = null;
}

function getPopupSize(settings = getSettings()) {
  const preset = settings.popoutWindowSize || "standard";
  if (preset === "custom") {
    return {
      width: clampPopupDimension(settings.popoutWindowWidth, 1280, 900, 3840),
      height: clampPopupDimension(settings.popoutWindowHeight, 900, 600, 2160),
    };
  }
  return POPUP_SIZE_PRESETS[preset] || POPUP_SIZE_PRESETS.standard;
}

function getPopupSizeKey(settings = getSettings()) {
  const preset = settings.popoutWindowSize || "standard";
  const { width, height } = getPopupSize(settings);
  return `${preset}:${width}x${height}`;
}

function getPopupWindowFeatures(settings = getSettings()) {
  const { width, height } = getPopupSize(settings);
  return `left=100,top=100,width=${width},height=${height},resizable=yes,scrollbars=yes`;
}

function removeInlineModal() {
  document.querySelector(".aram-modal-overlay")?.remove();
}

function sendWindowCommand(win, name, params = []) {
  try {
    if (typeof win.riotInvoke !== "function") return;
    win.riotInvoke({
      request: JSON.stringify({ name, params }),
    });
  } catch {}
}

function ensurePopupDocument(win, title) {
  const doc = win.document;

  doc.open();
  doc.write(
    "<!doctype html><html><head><title>Mayhem Doctor</title></head><body class=\"aram-popout-body\"></body></html>",
  );
  doc.close();

  doc.title = title;

  const styleEl = doc.createElement("style");
  styleEl.id = "mayhem-doctor-popout-styles";
  styleEl.textContent = `${STYLES}\n${POPUP_WINDOW_STYLES}`;
  doc.head.appendChild(styleEl);

  const root = doc.createElement("div");
  root.className = "aram-popout-window";

  const content = doc.createElement("div");
  content.className = "aram-modal-content";

  root.appendChild(content);
  doc.body.appendChild(root);

  const resizer = doc.createElement("div");
  resizer.className = "aram-resize-handle";
  doc.body.appendChild(resizer);

  let currentWidth = 0, currentHeight = 0, currentX = 0, currentY = 0;
  let lastWidth = 0, lastHeight = 0;
  let isDragging = false;

  const dragMove = (event) => {
    if (!isDragging) return;
    let newHeight = 0;
    let newWidth = 0;

    const deltaX = event.screenX - currentX;
    const deltaY = event.screenY - currentY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      newWidth = currentWidth + deltaX;
      newHeight = newWidth * (currentHeight / currentWidth);
    } else {
      newHeight = currentHeight + deltaY;
      newWidth = newHeight * (currentWidth / currentHeight);
    }

    newWidth = Math.max(900, Math.min(3840, Math.round(newWidth)));
    newHeight = Math.max(600, Math.min(2160, Math.round(newHeight)));

    if (Math.abs(newWidth - lastWidth) >= 4 || Math.abs(newHeight - lastHeight) >= 4) {
      lastWidth = newWidth;
      lastHeight = newHeight;
      sendWindowCommand(win, "Window.ResizeTo", [newWidth, newHeight]);
    }
  };

  const dragStart = (event) => {
    event.stopPropagation();
    event.preventDefault();
    isDragging = true;
    currentX = event.screenX;
    currentY = event.screenY;
    currentWidth = doc.body.offsetWidth || win.outerWidth || 1280;
    currentHeight = doc.body.offsetHeight || win.outerHeight || 900;
    lastWidth = currentWidth;
    lastHeight = currentHeight;
    win.addEventListener("mousemove", dragMove);
  };

  const dragEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    win.removeEventListener("mousemove", dragMove);
    const newWidth = lastWidth || doc.body.offsetWidth || 1280;
    const newHeight = lastHeight || doc.body.offsetHeight || 900;
    updateSetting("popoutWindowSize", "custom");
    updateSetting("popoutWindowWidth", newWidth);
    updateSetting("popoutWindowHeight", newHeight);
    window.dispatchEvent(new Event("md-settings-sync-window"));
  };

  resizer.addEventListener("mousedown", dragStart);
  win.addEventListener("mouseup", dragEnd);

  return content;
}

function bindPopupLifecycle(win) {
  if (win.__mdPopoutLifecycleBound) return;

  const clearRef = () => {
    if (popupWindowRef === win) popupWindowRef = null;
  };

  win.addEventListener("beforeunload", clearRef);
  win.addEventListener("pagehide", clearRef);
  win.__mdPopoutLifecycleBound = true;
}

function createInlineHost(title = "Mayhem Doctor") {
  closePopupWindow();
  removeInlineModal();

  const overlay = document.createElement("div");
  overlay.className = "aram-modal-overlay";

  const content = document.createElement("div");
  content.className = "aram-modal-content";

  overlay.appendChild(content);
  document.body.appendChild(overlay);

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };

  return {
    mode: "inline",
    content,
    close: () => overlay.remove(),
    focus: () => window.focus(),
    isOpen: () => document.body.contains(overlay),
    setTitle: () => {},
  };
}

function createPopupHost(title = "Mayhem Doctor") {
  removeInlineModal();
  const settings = getSettings();
  const sizeKey = getPopupSizeKey(settings);
  const { width, height } = getPopupSize(settings);

  let win = getPopupWindow();
  let isNewWindow = false;
  if (!win) {
    win = window.open(
      "about:blank",
      POPUP_WINDOW_NAME,
      getPopupWindowFeatures(settings),
    );
    if (!win) return null;
    popupWindowRef = win;
    bindPopupLifecycle(win);
    isNewWindow = true;
  }

  if (isNewWindow || win.__mdPopupSizeKey !== sizeKey) {
    sendWindowCommand(win, "Window.ResizeTo", [width, height]);
    sendWindowCommand(win, "Window.CenterToScreen");
    win.__mdPopupSizeKey = sizeKey;
  }
  sendWindowCommand(win, "Window.Show");

  const content = ensurePopupDocument(win, title);

  try {
    win.focus();
  } catch {}

  return {
    mode: "popup",
    window: win,
    content,
    close: () => {
      try {
        win.close();
      } catch {}
      if (popupWindowRef === win) popupWindowRef = null;
    },
    focus: () => {
      try {
        win.focus();
      } catch {}
    },
    isOpen: () => !win.closed,
    setTitle: (nextTitle) => {
      try {
        win.document.title = nextTitle;
      } catch {}
    },
  };
}

export function createModalHost(options = {}) {
  const { title = "Mayhem Doctor", preferPopup = true } = options;
  const settings = getSettings();

  if (preferPopup && settings.openModalInNewWindow) {
    const popupHost = createPopupHost(title);
    if (popupHost) return popupHost;
  }

  return createInlineHost(title);
}

export function createModal(options = {}) {
  return createModalHost(options).content;
}

export function hasOpenMayhemWindow() {
  return Boolean(document.querySelector(".aram-modal-overlay") || getPopupWindow());
}

export function closeMayhemWindow() {
  removeInlineModal();
  closePopupWindow();
}

export async function displayStats(
  modalContent,
  finalStats,
  fullHistory,
  opts = {},
) {
  await renderStatsInto(modalContent, finalStats, fullHistory, {
    showClose: true,
    ...opts,
  });
}

// Command bar modal
export async function openCommandBarModal() {
  await loadSettings();

  const host = createModalHost({ title: "Mayhem Doctor" });
  const modalContent = host.content;

  function closeHost() {
    host.close();
  }

  function isHostOpen() {
    return host.isOpen();
  }

  function setHostTitle(title) {
    host.setTitle(title);
  }

  function setStatus(type, msg) {
    if (!isHostOpen()) return;
    const bar = modalContent.querySelector("#cb-status-bar");
    if (!bar) return;
    bar.className = `mi-status-bar mi-status-${type}`;
    bar.textContent = msg;
    bar.style.display = "block";
  }

  function runAndRender(startFn, args, title) {
    modalContent.classList.remove("aram-modal-home-screen");
    setHostTitle(title);
    modalContent.innerHTML = `
            <div class="aram-modal-close" title="Close">&times;</div>
            <h2 id="cb-title">${title}</h2>
            <div id="cb-status-bar" class="mi-status-bar mi-status-info"></div>
        `;
    modalContent.querySelector(".aram-modal-close").onclick = closeHost;

    startFn(
      async (update) => {
        if (!isHostOpen()) return;
        if (update.status) setStatus("info", update.status);
        if (update.error) setStatus("error", `Error: ${update.error}`);
        if (update.finalStats) {
          await renderStatsInto(
            modalContent,
            update.finalStats,
            update.fullHistory,
            {
              showClose: true,
              showHome: true,
              onHome: () => renderHome(),
              onClose: closeHost,
              title,
            },
          );
        }
      },
      ...args,
    );
  }

  // Picker screen
  async function renderHome() {
    if (!isHostOpen()) return;

    setHostTitle("Mayhem Doctor");
    modalContent.classList.add("aram-modal-home-screen");

    const settings = getSettings();
    const currentSavedCount = settings.lastAnalysisCount || 50;

    modalContent.innerHTML =
      '<div class="mi-status-bar mi-status-info" style="margin:40px auto; width: fit-content; background: transparent; border: none;">Loading dashboard...</div>';

    const dashData = await getHomeDashboardData();
    if (!isHostOpen()) return;

    let dashboardHtml = "";

    if (dashData) {
      const wr = (
        (dashData.wins / Math.max(1, dashData.wins + dashData.losses)) *
        100
      ).toFixed(1);

      dashboardHtml = `
          <div class="home-dash">
              <div class="dash-welcome">
                  <span class="dash-label">Your Dashboard (Last ${dashData.lookback})</span>
                  <div class="dash-summary">${dashData.wins}W - ${dashData.losses}L &bull; <span class="aram-win-high">${wr}% WR</span></div>
                  <div class="dash-trend">
                      ${dashData.trend.map((res) => `<div class="trend-dot ${res === "Win" ? "win" : res === "Loss" ? "loss" : "remake"}"></div>`).join("")}
                      <span class="trend-label">Recent Trend</span>
                  </div>
              </div>
              <div class="dash-highlights">
                  <div class="dash-section">
                      <span class="dash-label">Performance Analytics</span>
                      <div class="dash-analytics-grid">
                          <div class="dash-analytic-item">
                              <span class="analytic-label">Avg KDA</span>
                              <span class="analytic-value">${dashData.avgKda}</span>
                          </div>
                          <div class="dash-analytic-item">
                              <span class="analytic-label">Avg DPM</span>
                              <span class="analytic-value">${dashData.avgDpm}</span>
                          </div>
                          <div class="dash-analytic-item">
                              <span class="analytic-label">Avg GPM</span>
                              <span class="analytic-value">${dashData.avgGpm}</span>
                          </div>
                          <div class="dash-analytic-item">
                              <span class="analytic-label">Avg KP%</span>
                              <span class="aram-win-high analytic-value">${dashData.avgKp}%</span>
                          </div>
                      </div>
                  </div>
                  <div class="dash-section">
                      <span class="dash-label dash-label-spaced">Performance Form</span>
                      <div class="dash-analytics-grid dash-analytics-grid--form">
                          <div class="dash-analytic-item">
                              <span class="analytic-label">Diversity</span>
                              <span class="analytic-value">${dashData.diversity} Unique Champions</span>
                          </div>
                          <div class="dash-analytic-item">
                              <span class="analytic-label">Avg Length</span>
                              <span class="analytic-value">${dashData.avgDuration}m</span>
                          </div>
                          <div class="dash-analytic-item">
                              <span class="analytic-label">Current Streak</span>
                              <span class="analytic-value ${dashData.streak.includes("Win") ? "aram-win-high" : "aram-loss-text"}">${dashData.streak}</span>
                          </div>
                      </div>
                  </div>
                  <div class="dash-section">
                      <span class="dash-label dash-label-spaced">Top Champions (Current Window)</span>
                      <div class="dash-champs">
                          ${dashData.topChamps.map((c) => `
                              <div class="dash-champ-card">
                                  <img src="/lol-game-data/assets/v1/champion-icons/${c.id}.png" class="aram-icon">
                                  <div class="dash-champ-info">
                                      <div class="dash-champ-stats">${c.games}G &bull; ${((c.wins / c.games) * 100).toFixed(0)}%</div>
                                  </div>
                              </div>
                          `).join("")}
                      </div>
                  </div>
                  <div class="dash-section">
                      <span class="dash-label dash-label-spaced-lg">Overall Records (All-Time)</span>
                      <div class="dash-analytics-grid dash-analytics-grid--lifetime">
                          <div class="dash-analytic-item">
                              <span class="analytic-label">Lifetime Diversity</span>
                              <span class="analytic-value">${dashData.lifetimeDiversity} Unique Champions Played</span>
                          </div>
                          <div class="dash-analytic-item">
                              <span class="analytic-label">Average Game Length (${dashData.lifetimeAvgLen} Minutes)</span>
                              <span class="analytic-value">${dashData.lifetimeTimeStr} in Mayhem</span>
                          </div>
                      </div>
                  <div class="dash-champs dash-champs--lifetime">
                      ${dashData.lifetimeTopChamps.map((c) => `
                          <div class="dash-lifetime-champ" title="${c.games} Games Played">
                              <img src="/lol-game-data/assets/v1/champion-icons/${c.id}.png" class="dash-lifetime-icon">
                              <div class="dash-lifetime-count">${c.games}</div>
                          </div>
                      `).join("")}
                      <span class="analytic-label dash-lifetime-label">All-Time Favorites</span>
                  </div>
              </div>
              <div class="dash-footer">Cached: ${dashData.totalGames} games &nbsp;&bull;&nbsp; Updated: ${new Date(dashData.savedAt).toLocaleTimeString()}</div>
          </div>
      `;
    }

    const infoHtml = `
        <div class="home-info">
            <div class="info-section">
                <span class="dash-label">Key Concepts</span>
                <ul class="info-tips">
                    <li><b>Global Champions:</b> Aggregates data from all players you've encountered.</li>
                    <li><b>Investigator:</b> Check any Riot ID to see performance analytics.</li>
                    <li><b>Laplace Smoothing:</b> Favors consistency over luck in the analytics tabs.</li>
                </ul>
            </div>
            <div class="info-section branding" style="margin-top: auto; padding-top: 15px; border-top: 1px solid rgba(120,90,40,0.1);">
                <div class="branding-content">
                    <div class="branding-title">Mayhem Doctor</div>
                    <div class="branding-dev">by Reformed Doge</div>
                    <div class="branding-version">v${getCurrentVersion()} ${hasUpdate() ? '&bull; <span style="color: #c8aa6e; font-weight: 600;">Update Available</span>' : ""} &bull; <a href="https://github.com/ReformedDoge/Mayhem-Doctor" target="_blank" style="color: #c8aa6e; text-decoration: none;">GitHub</a></div>
                </div>
            </div>
        </div>
    `;

    modalContent.innerHTML = `
            <div class="aram-modal-tools">
                <div class="aram-modal-close" title="Close">&times;</div>
            </div>
            <h2 style="margin-bottom: 20px;">Mayhem Doctor</h2>
            <div class="home-layout">
                <div class="home-left">
                    <div class="mi-controls mi-controls--home">
                        <div class="mi-input-group">
                            <span class="dash-label">Analysis Settings</span>
                            <label class="mi-label mi-label-spaced" for="cb-game-count">Number of Games</label>
                            <div class="mi-slider-row">
                                <input id="cb-slider" class="mi-slider" type="range" min="10" max="1000" value="${currentSavedCount}">
                                <input id="cb-game-count" class="aram-number-input" type="number" value="${currentSavedCount}" min="10" max="1000">
                            </div>
                        </div>
                        <div class="cb-picker-buttons cb-picker-buttons--spaced">
                            <button id="cb-self-btn" class="aram-btn-start">Analyse My History</button>
                            <button id="cb-other-btn" class="aram-btn-start">Analyse Another Player</button>
                        </div>
                        <div id="cb-riot-id-row" class="mi-input-group" style="display:none;">
                            <label class="mi-label" for="cb-riot-id">Riot ID</label>
                            <div class="mi-slider-row">
                                <input id="cb-riot-id" class="mi-text-input" type="text" placeholder="GameName#TAG" spellcheck="false" autocomplete="off">
                                <button id="cb-investigate-btn" class="aram-btn-start">Investigate</button>
                            </div>
                        </div>
                    </div>
                    ${infoHtml}
                </div>
                <div class="home-right">
                    ${dashboardHtml}
                </div>
            </div>
        `;

    modalContent.querySelector(".aram-modal-close").onclick = closeHost;

    const slider = modalContent.querySelector("#cb-slider");
    const numInput = modalContent.querySelector("#cb-game-count");
    slider.oninput = () => {
      numInput.value = slider.value;
    };
    numInput.oninput = () => {
      slider.value = numInput.value;
    };

    modalContent.querySelector("#cb-self-btn").onclick = () => {
      const count = parseInt(numInput.value, 10) || 50;
      updateSetting("lastAnalysisCount", count);
      runAndRender(startSelfAnalysis, [count], "My Mayhem Stats");
    };

    modalContent.querySelector("#cb-other-btn").onclick = () => {
      modalContent.querySelector("#cb-riot-id-row").style.display = "";
      modalContent.querySelector("#cb-other-btn").style.display = "none";
    };

    modalContent.querySelector("#cb-investigate-btn").onclick = () => {
      const riotId = modalContent.querySelector("#cb-riot-id").value.trim();
      const count = parseInt(numInput.value, 10) || 50;

      if (!riotId || !riotId.includes("#")) {
        Toast.error("Please enter a valid Riot ID in the format GameName#TAG.");
        return;
      }

      updateSetting("lastAnalysisCount", count);
      runAndRender(
        startInvestigatorAnalysis,
        [riotId, count],
        `${riotId} - Mayhem Stats`,
      );
    };
  }

  await renderHome();
}
