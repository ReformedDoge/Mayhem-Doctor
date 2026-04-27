/**
 * Modal overlay factory and the commandBar action activation modal (Alt+X) or whatever hotkey.
 */

import {
  startSelfAnalysis,
  startInvestigatorAnalysis,
  getHomeDashboardData,
} from "../analysis.js";
import { renderStatsInto } from "./tabs.js";
import {
  getCurrentVersion,
  hasUpdate,
  getLatestRelease,
  loadSettings,
  updateSetting,
  getSettings,
} from "./settings.js";

//  Modal factory
export function createModal() {
  const overlay = document.createElement("div");
  overlay.className = "aram-modal-overlay";
  const content = document.createElement("div");
  content.className = "aram-modal-content";
  overlay.appendChild(content);
  document.body.appendChild(overlay);
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  return content;
}

export async function displayStats(modalContent, finalStats, fullHistory) {
  await renderStatsInto(modalContent, finalStats, fullHistory, {
    showClose: true,
  });
}

//  Command bar modal
export async function openCommandBarModal() {
  const modalContent = createModal();

  function setStatus(type, msg) {
    const bar = modalContent.querySelector("#cb-status-bar");
    if (!bar) return;
    bar.className = `mi-status-bar mi-status-${type}`;
    bar.textContent = msg;
    bar.style.display = "block";
  }

  function runAndRender(startFn, args, title) {
    modalContent.innerHTML = `
            <div class="aram-modal-close" title="Close">&times;</div>
            <h2 id="cb-title">${title}</h2>
            <div id="cb-status-bar" class="mi-status-bar mi-status-info"></div>
        `;
    modalContent.querySelector(".aram-modal-close").onclick = () =>
      modalContent.parentElement.remove();

    startFn(
      async (update) => {
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
              onHome: () => renderHome(), // Triggers fresh render
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
    const settings = getSettings();
    const currentSavedCount = settings.lastAnalysisCount || 50;

    modalContent.innerHTML = `<div class="mi-status-bar mi-status-info" style="margin:40px auto; width: fit-content; background: transparent; border: none;">Loading dashboard...</div>`;
    const dashData = await getHomeDashboardData();
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
                  <div class="dash-summary">${dashData.wins}W - ${dashData.losses}L • <span class="aram-win-high">${wr}% WR</span></div>
                  <div class="dash-trend">
                      ${dashData.trend.map((res) => `<div class="trend-dot ${res === "Win" ? "win" : res === "Loss" ? "loss" : "remake"}"></div>`).join("")}
                      <span class="trend-label">Recent Trend</span>
                  </div>
              </div>
              <div class="dash-highlights">
                  <span class="dash-label">Performance Analytics</span>
                  <div class="dash-analytics-grid">
                      <div class="dash-analytic-item"><span class="analytic-label">Avg KDA</span><span class="analytic-value">${dashData.avgKda}</span></div>
                      <div class="dash-analytic-item"><span class="analytic-label">Avg DPM</span><span class="analytic-value">${dashData.avgDpm}</span></div>
                      <div class="dash-analytic-item"><span class="analytic-label">Avg GPM</span><span class="analytic-value">${dashData.avgGpm}</span></div>
                      <div class="dash-analytic-item"><span class="analytic-label">Avg KP%</span><span class="aram-win-high analytic-value">${dashData.avgKp}%</span></div>
                  </div>

                  <span class="dash-label" style="margin-top:20px;">Performance Form</span>
                  <div class="dash-analytics-grid" style="grid-template-columns: repeat(3, 1fr);">
                      <div class="dash-analytic-item"><span class="analytic-label">Diversity</span><span class="analytic-value">${dashData.diversity} Unique Champions</span></div>
                      <div class="dash-analytic-item"><span class="analytic-label">Avg Length</span><span class="analytic-value">${dashData.avgDuration}m</span></div>
                      <div class="dash-analytic-item"><span class="analytic-label">Current Streak</span><span class="analytic-value ${dashData.streak.includes("Win") ? "aram-win-high" : "aram-loss-text"}">${dashData.streak}</span></div>
                  </div>

                  <span class="dash-label" style="margin-top:20px;">Top Champions (Current Window)</span>
                  <div class="dash-champs">
                      ${dashData.topChamps
                        .map(
                          (c) => `
                          <div class="dash-champ-card">
                              <img src="/lol-game-data/assets/v1/champion-icons/${c.id}.png" class="aram-icon">
                              <div class="dash-champ-info">
                                  <div class="dash-champ-stats">${c.games}G • ${((c.wins / c.games) * 100).toFixed(0)}%</div>
                              </div>
                          </div>
                      `,
                        )
                        .join("")}
                  </div>

                  <span class="dash-label" style="margin-top:24px;">Overall Records (All-Time)</span>
                  <div class="dash-analytics-grid" style="grid-template-columns: repeat(2, 1fr); gap: 8px;">
                      <div class="dash-analytic-item" style="padding: 8px 12px;"><span class="analytic-label">Lifetime Diversity</span><span class="analytic-value">${dashData.lifetimeDiversity} Champions</span></div>
                      <div class="dash-analytic-item" style="padding: 8px 12px;"><span class="analytic-label">All-Time Playtime</span><span class="analytic-value">${dashData.lifetimeTimeStr}</span></div>
                  </div>
                  <div class="dash-champs" style="margin-top: 8px; justify-content: flex-start; gap: 6px;">
                      ${dashData.lifetimeTopChamps
                        .map(
                          (c) => `
                          <div style="position: relative; width: 32px; height: 32px;" title="${c.games} Games Played">
                              <img src="/lol-game-data/assets/v1/champion-icons/${c.id}.png" style="width: 32px; height: 32px; border-radius: 4px; border: 1px solid #3a4a55;">
                              <div style="position: absolute; bottom: -2px; right: -2px; background: #010a13; font-size: 8px; padding: 1px 3px; border: 1px solid #785a28; color: #f0e6d2; border-radius: 2px;">${c.games}</div>
                          </div>
                      `,
                        )
                        .join("")}
                      <span class="analytic-label" style="align-self: center; margin-left: 5px;">All-Time Favorites</span>
                  </div>
              </div>
              <div class="dash-footer">Cached: ${dashData.totalGames} games &nbsp;•&nbsp; Updated: ${new Date(dashData.savedAt).toLocaleTimeString()}</div>
          </div>
      `;
    }

    const infoHtml = `
        <div class="home-info">
            <div class="info-section">
                <span class="dash-label">Pro Tips</span>
                <ul class="info-tips">
                    <li><b>Global Champions:</b> Aggregates data from all players encountered in your history.</li>
                    <li><b>Investigator:</b> Check any Riot ID to see performance analytics.</li>
                    <li><b>Laplace Smoothing:</b> Favors consistency over luck in the analytics tabs.</li>
                </ul>
            </div>
            <div class="info-section branding" style="margin-top: auto; padding-top: 15px; border-top: 1px solid rgba(120,90,40,0.1);">
                <div class="branding-content">
                    <div class="branding-title">Mayhem Doctor</div>
                    <div class="branding-dev">by Reformed Doge</div>
                    <div class="branding-version">v${getCurrentVersion()} ${hasUpdate() ? '• <span style="color: #c8aa6e; font-weight: 600;">✦ Update</span>' : ""} • <a href="https://github.com/ReformedDoge/Mayhem-Doctor" target="_blank" style="color: #c8aa6e; text-decoration: none;">GitHub</a></div>
                </div>
            </div>
        </div>
    `;

    modalContent.innerHTML = `
            <div class="aram-modal-close" title="Close">&times;</div>
            <h2 style="margin-bottom: 20px;">Mayhem Doctor</h2>
            <div class="home-layout">
                <div class="home-left">
                    <div class="mi-controls" style="min-height: 180px;">
                        <div class="mi-input-group">
                            <span class="dash-label">Analysis Settings</span>
                            <label class="mi-label" for="cb-game-count" style="margin-top: 5px;">Number of Games</label>
                            <div class="mi-slider-row">
                                <input id="cb-slider" class="mi-slider" type="range" min="10" max="1000" value="${currentSavedCount}">
                                <input id="cb-game-count" class="aram-number-input" type="number" value="${currentSavedCount}" min="10" max="1000">
                            </div>
                        </div>
                        <div class="cb-picker-buttons" style="margin-top: 15px;">
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

    modalContent.querySelector(".aram-modal-close").onclick = () =>
      modalContent.parentElement.remove();

    const slider = modalContent.querySelector("#cb-slider");
    const numInput = modalContent.querySelector("#cb-game-count");
    slider.oninput = () => {
      numInput.value = slider.value;
    };
    numInput.oninput = () => {
      slider.value = numInput.value;
    };

    modalContent.querySelector("#cb-self-btn").onclick = () => {
      const count = parseInt(numInput.value) || 50;
      updateSetting("lastAnalysisCount", count);
      runAndRender(startSelfAnalysis, [count], "My Mayhem Stats");
    };

    modalContent.querySelector("#cb-other-btn").onclick = () => {
      modalContent.querySelector("#cb-riot-id-row").style.display = "";
      modalContent.querySelector("#cb-other-btn").style.display = "none";
    };

    modalContent.querySelector("#cb-investigate-btn").onclick = () => {
      const riotId = modalContent.querySelector("#cb-riot-id").value.trim();
      const count = parseInt(numInput.value) || 50;
      if (!riotId || !riotId.includes("#")) {
        Toast.error("Please enter a valid Riot ID in the format GameName#TAG.");
        return;
      }
      updateSetting("lastAnalysisCount", count);
      runAndRender(
        startInvestigatorAnalysis,
        [riotId, count],
        `${riotId} — Mayhem Stats`,
      );
    };
  }

  await loadSettings();
  renderHome();
}
