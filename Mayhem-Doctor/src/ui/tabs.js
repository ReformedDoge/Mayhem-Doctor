/**
 * The main tab renderers and renderStatsInto which mounts them into any target element.
 * Tabs: General Stats, Match History, Specific Champions, Lobby Stats, Settings.
 */

import { CHAMPION_DATA, AUGMENT_DATA, ITEM_DATA } from "../lcu.js";
import {
  accumulateStats,
  buildGlobalStats,
  smoothedWinRate,
} from "../analysis.js";
import { createInteractiveTable } from "./table.js";
import { openAramMatchView } from "./matchView.js";
import { buildAugSection } from "./augments.js";
import { buildItemSection } from "./items.js";
import { createPatchFilter, toPatchLabel } from "./patchFilter.js";
import {
  renderSettingsTab,
  checkForUpdates,
  loadSettings,
} from "./settings.js";

//  Champion name fuzzy matching
function normaliseChampName(name) {
  return name.toLowerCase().replace(/['\s]/g, "");
}

function champMatchesQuery(champName, query) {
  if (!query) return true;
  const q = normaliseChampName(query);
  const name = champName.toLowerCase();
  const nameNorm = normaliseChampName(champName);
  if (nameNorm.startsWith(q)) return true;
  const words = name.split(/[\s']/);
  if (words.some((w) => w.startsWith(q))) return true;
  return false;
}

//  General tab
export function renderGeneralTab(stats, onChampClick) {
  const container = document.createElement("div");
  const totalGames = stats.wins + stats.losses;
  const winRate =
    totalGames > 0 ? ((stats.wins / totalGames) * 100).toFixed(1) : 0;
  const remakeStr =
    stats.remakes > 0
      ? ` &bull; <span class="aram-remake-count">${stats.remakes} Remake${stats.remakes > 1 ? "s" : ""}</span>`
      : "";

  const summary = document.createElement("div");
  summary.className = "aram-summary-bar";
  summary.innerHTML = `Analyzed: <b>${totalGames}</b> Valid Games &bull; <span class="aram-win-high">${stats.wins}W</span> <span class="aram-dash">-</span> <span class="aram-win-low">${stats.losses}L</span> <span class="aram-winrate">(${winRate}%)</span>${remakeStr}`;
  container.appendChild(summary);

  const makeHeader = (text) => {
    const h = document.createElement("h3");
    h.textContent = text;
    return h;
  };

  const champData = Object.entries(stats.champions).map(([id, d]) => {
    const actualWr = (d.wins / d.games) * 100;
    return {
      id,
      name: CHAMPION_DATA[id] || `ID ${id}`,
      ...d,
      winRate: actualWr,
      kda: (d.kills + d.assists) / Math.max(1, d.deaths),
      avgDmg: d.dmg / d.games,
    };
  });
  container.appendChild(makeHeader("Champions"));
  container.appendChild(
    createInteractiveTable([
        {
          label: "Champion",
          key: "name",
          render: (r) =>
            `<div class="aram-icon-cell"><img src="/lol-game-data/assets/v1/champion-icons/${r.id}.png" class="aram-icon"> ${r.name}</div>`,
        },
        { label: "Games", key: "games" },
        {
          label: "Win %",
          key: "winRate",
          render: (r) =>
            `<span class="${r.winRate >= 60 ? "aram-win-high" : r.winRate <= 40 ? "aram-win-low" : ""}">${r.winRate.toFixed(1)}%</span>`,
        },
        { label: "KDA", key: "kda", render: (r) => r.kda.toFixed(2) },
        {
          label: "Avg Dmg",
          key: "avgDmg",
          render: (r) =>
            r.avgDmg.toLocaleString("en", { maximumFractionDigits: 0 }),
        },
      ],
      champData,
      "games",
      false,
      (row) => {
        if (onChampClick) onChampClick(row.id);
      },
    ),
  );

  const augData = Object.entries(stats.augments)
    .map(([id, d]) => ({
      id,
      name: (AUGMENT_DATA[id] || { name: `Augment ${id}` }).name,
      icon: (AUGMENT_DATA[id] || { icon: "" }).icon,
      ...d,
      winRate: smoothedWinRate(d.wins, d.games),
    }))
    .filter((d) => d.games >= 2);
  container.appendChild(makeHeader("Augments (min 2 picks)"));
  container.appendChild(
    createInteractiveTable([
        {
          label: "Augment",
          key: "name",
          render: (r) =>
            `<div class="aram-icon-cell">${r.icon ? `<img src="${r.icon}" class="aram-icon">` : ""} ${r.name}</div>`,
        },
        { label: "Picked", key: "games" },
        {
          label: "Win %",
          key: "winRate",
          render: (r) =>
            `<span class="${r.winRate >= 60 ? "aram-win-high" : r.winRate <= 40 ? "aram-win-low" : ""}">${r.winRate.toFixed(1)}%</span>`,
        },
      ],
      augData,
      "games",
    ),
  );

  const itemData = Object.entries(stats.items)
    .map(([id, d]) => ({
      id,
      name: (ITEM_DATA[id] || { name: `Item ${id}` }).name,
      icon: (ITEM_DATA[id] || { icon: "" }).icon,
      ...d,
      winRate: smoothedWinRate(d.wins, d.games),
    }))
    .filter((d) => d.games >= 2);
  container.appendChild(makeHeader("Items (min 2 builds)"));
  container.appendChild(
    createInteractiveTable([
        {
          label: "Item",
          key: "name",
          render: (r) =>
            `<div class="aram-icon-cell">${r.icon ? `<img src="${r.icon}" class="aram-icon">` : ""} ${r.name}</div>`,
        },
        { label: "Built", key: "games" },
        {
          label: "Win %",
          key: "winRate",
          render: (r) =>
            `<span class="${r.winRate >= 60 ? "aram-win-high" : r.winRate <= 40 ? "aram-win-low" : ""}">${r.winRate.toFixed(1)}%</span>`,
        },
      ],
      itemData,
      "games",
    ),
  );

  return container;
}

//  Match history tab
export function renderHistoryTab(
  history,
  selectedChamps,
  onFilterChange,
  doc = document,
) {
  const container = doc.createElement("div");
  container.className = "mh-root";

  // Filter UI
  const filterContainer = doc.createElement("div");
  filterContainer.className = "mh-filter-container";

  const chipsContainer = doc.createElement("div");
  chipsContainer.className = "mh-chips-container";

  const inputWrapper = doc.createElement("div");
  inputWrapper.className = "mh-filter-input-wrapper";

  const filterInput = doc.createElement("input");
  filterInput.className = "mh-filter-input";
  filterInput.placeholder = "Filter by champions (e.g. Malphite, Jinx)...";
  filterInput.spellcheck = false;
  inputWrapper.appendChild(filterInput);

  const dropdown = doc.createElement("div");
  dropdown.className = "mh-dropdown";

  filterContainer.appendChild(chipsContainer);
  filterContainer.appendChild(inputWrapper);
  filterContainer.appendChild(dropdown);
  container.appendChild(filterContainer);

  const updateChips = () => {
    chipsContainer.innerHTML = "";
    selectedChamps.forEach((id) => {
      const name = CHAMPION_DATA[id] || `ID ${id}`;
      const chip = doc.createElement("div");
      chip.className = "mh-chip";
      chip.innerHTML = `
                <img src="/lol-game-data/assets/v1/champion-icons/${id}.png" style="width:16px;height:16px;border-radius:2px;">
                <span>${name}</span>
                <span class="mh-chip-remove">&times;</span>
            `;
      chip.querySelector(".mh-chip-remove").onclick = () => {
        selectedChamps.delete(id);
        updateChips();
        onFilterChange();
      };
      chipsContainer.appendChild(chip);
    });
  };

  const renderDropdown = (query) => {
    dropdown.innerHTML = "";
    if (!query && selectedChamps.size === 0) {
      dropdown.style.display = "none";
      return;
    }

    const playedIds =[...new Set(history.map((h) => String(h.championId)))];
    const filtered = playedIds
      .map((id) => ({ id, name: CHAMPION_DATA[id] || `ID ${id}` }))
      .filter(
        (c) => !selectedChamps.has(c.id) && champMatchesQuery(c.name, query),
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    if (filtered.length === 0) {
      dropdown.style.display = "none";
      return;
    }

    filtered.forEach((c) => {
      const item = doc.createElement("div");
      item.className = "mh-dropdown-item";
      item.innerHTML = `
                <img src="/lol-game-data/assets/v1/champion-icons/${c.id}.png">
                <span class="name">${c.name}</span>
            `;
      item.onclick = () => {
        selectedChamps.add(c.id);
        filterInput.value = "";
        dropdown.style.display = "none";
        updateChips();
        onFilterChange();
      };
      dropdown.appendChild(item);
    });
    dropdown.style.display = "block";
  };

  filterInput.oninput = () => renderDropdown(filterInput.value.trim());
  filterInput.onfocus = () => renderDropdown(filterInput.value.trim());

  doc.addEventListener("click", (e) => {
    if (!filterContainer.contains(e.target)) dropdown.style.display = "none";
  });

  updateChips();

  // Filter Data
  const filteredHistory =
    selectedChamps.size === 0
      ? history
      : history.filter((h) => selectedChamps.has(String(h.championId)));

  const historyData = filteredHistory.map((h) => ({
    ...h,
    resultDisplay:
      h.result === "Win" ? "Win" : h.result === "Loss" ? "Loss" : "Remake",
    durationDisplay: `${Math.floor(h.gameDuration / 60)}m ${h.gameDuration % 60}s`,
  }));

  if (historyData.length === 0) {
    const empty = doc.createElement("div");
    empty.className = "sc-empty";
    empty.style.padding = "40px";
    empty.textContent = "No matches found for the selected filter.";
    container.appendChild(empty);
  } else {
    container.appendChild(
      createInteractiveTable([
          {
            label: "Result",
            key: "resultDisplay",
            render: (r) =>
              `<span class="${r.result === "Win" ? "aram-win-high" : r.result === "Loss" ? "aram-win-low" : "remake-indicator"}">${r.resultDisplay}</span>`,
          },
          {
            label: "Champion",
            key: "championName",
            render: (r) =>
              `<div class="aram-icon-cell"><img src="/lol-game-data/assets/v1/champion-icons/${r.championId}.png" class="aram-icon"> ${r.championName}</div>`,
          },
          { label: "KDA", key: "kda" },
          {
            label: "Damage",
            key: "dmg",
            render: (r) => r.dmg.toLocaleString(),
          },
          {
            label: "Duration",
            key: "gameDuration",
            render: (r) => r.durationDisplay,
          },
          {
            label: "Items",
            key: "items",
            render: (r) =>
              r.items
                .map((id) =>
                  ITEM_DATA[id]
                    ? `<img src="${ITEM_DATA[id].icon}" class="aram-icon" title="${ITEM_DATA[id].name}">`
                    : "",
                )
                .join(""),
          },
          {
            label: "",
            key: "gameVersion",
            render: (r) =>
              `<span class="aram-version-badge" title="${r.gameVersion}">!</span>`,
          },
        ],
        historyData,
        "gameCreation",
        false,
        (row, e) => {
          const targetContainer = e.target.closest(
            ".aram-modal-content, #mi-results",
          );
          openAramMatchView(row.rawGame, targetContainer);
        },
      ),
    );
  }
  return container;
}

//  Shared champion detail view
function buildChampDetailView(
  c,
  games,
  cAugStats,
  cItemStats,
  onBack,
  onFilter,
) {
  const detailView = document.createElement("div");
  detailView.className = "sc-detail-view";

  const totalGames = c.games;
  const wr =
    totalGames > 0 ? smoothedWinRate(c.wins, totalGames).toFixed(1) : 0;
  const wrClass =
    parseFloat(wr) >= 60
      ? "aram-win-high"
      : parseFloat(wr) <= 40
        ? "aram-win-low"
        : "aram-winrate";
  const kdaVal = ((c.kills + c.assists) / Math.max(1, c.deaths)).toFixed(2);
  const avgDmg =
    totalGames > 0 ? Math.round(c.dmg / totalGames).toLocaleString() : "—";

  const controls = document.createElement("div");
  controls.className = "sc-detail-controls";
  controls.style.display = "grid";
  controls.style.gridAutoFlow = "column";
  controls.style.gridAutoColumns = "1fr";
  controls.style.gap = "10px";
  controls.style.marginBottom = "15px";
  controls.style.width = "fit-content";

  const backBtn = document.createElement("button");
  backBtn.className = "sc-back-btn aram-btn-start";
  backBtn.textContent = "← Back to Champions";
  backBtn.onclick = onBack;
  controls.appendChild(backBtn);

  if (onFilter) {
    const filterBtn = document.createElement("button");
    filterBtn.className = "sc-filter-btn aram-btn-start";
    filterBtn.textContent = `${c.name} Matches`;
    filterBtn.onclick = () => onFilter(c.id);
    controls.appendChild(filterBtn);
  }

  detailView.appendChild(controls);

  const header = document.createElement("div");
  header.className = "sc-detail-header";
  header.innerHTML = `
        <img src="/lol-game-data/assets/v1/champion-icons/${c.id}.png" class="sc-detail-icon" alt="${c.name}">
        <div class="sc-detail-title">
            <div class="sc-detail-champ-name">${c.name}</div>
            <div class="sc-detail-stats">
                <span class="aram-win-high">${c.wins}W</span> <span class="aram-dash"> — </span> <span class="aram-win-low">${c.losses}L</span>
                <span class="aram-dash"> &bull; </span> <span class="${wrClass}">${wr}% WR (Laplace smoothing)</span> <span class="aram-dash"> &bull; </span>
                <span class="sc-total-games">${totalGames} Total Game${totalGames !== 1 ? "s" : ""}</span> <span class="aram-dash"> &bull; </span>
                <span class="sc-kda-label">KDA: <b>${kdaVal}</b></span> <span class="aram-dash"> &bull; </span>
                <span class="sc-dmg-label">Avg Dmg: <b>${avgDmg}</b></span>
            </div>
        </div>`;
  detailView.appendChild(header);

  const mainRow = document.createElement("div");
  mainRow.className = "sc-detail-cols";
  mainRow.appendChild(buildAugSection(games, cAugStats, totalGames));
  mainRow.appendChild(buildItemSection(games, cItemStats));
  detailView.appendChild(mainRow);

  return detailView;
}

//  Specific Champions tab (focal player data only)
export function renderSpecificChampionsTab(stats, fullHistory, onChampClick) {
  const root = document.createElement("div");
  root.className = "sc-root";

  const champEntries = Object.entries(stats.champions)
    .map(([id, d]) => ({
      id,
      name: CHAMPION_DATA[id] || `Champion ${id}`,
      games: d.games,
      wins: d.wins,
      losses: d.games - d.wins,
      kills: d.kills,
      deaths: d.deaths,
      assists: d.assists,
      dmg: d.dmg,
    }))
    .sort((a, b) => b.games - a.games);

  const champItemStats = {};
  const champAugStats = {};
  const champGames = {};
  fullHistory.forEach((h) => {
    if (h.result === "Remake") return;
    const cId = String(h.championId);
    const win = h.result === "Win";
    const augments = (h.augments ||[]).map(Number).filter(Boolean);
    const items = (h.items ||[]).map(Number).filter(Boolean);

    if (!champItemStats[cId]) champItemStats[cId] = {};
    items.forEach((iId) => {
      if (!champItemStats[cId][iId])
        champItemStats[cId][iId] = { games: 0, wins: 0 };
      champItemStats[cId][iId].games++;
      if (win) champItemStats[cId][iId].wins++;
    });

    if (!champAugStats[cId]) champAugStats[cId] = {};
    augments.forEach((aId) => {
      if (!champAugStats[cId][aId])
        champAugStats[cId][aId] = { games: 0, wins: 0 };
      champAugStats[cId][aId].games++;
      if (win) champAugStats[cId][aId].wins++;
    });

    if (!champGames[cId]) champGames[cId] = [];
    champGames[cId].push({
      win,
      items,
      augments,
      orderedBuild: h.orderedBuild,
    });
  });

  return buildChampionGridView(
    champEntries,
    champGames,
    champItemStats,
    champAugStats,
    onChampClick,
  );
}

//  Global Champions tab (all participants aggregated)
export function renderGlobalChampionsTab(fullHistory, onChampClick) {
  const root = document.createElement("div");
  root.className = "sc-root";

  const note = document.createElement("p");
  note.className = "md-settings-note";
  note.textContent =
    "Aggregated from all players in your games. Higher sample sizes per champion.";
  note.style.marginBottom = "16px";
  root.appendChild(note);

  const { stats, champGames, champItemStats, champAugStats } =
    buildGlobalStats(fullHistory);

  const totalGames = stats.wins + stats.losses;
  if (totalGames === 0) {
    const empty = document.createElement("p");
    empty.className = "sc-empty";
    empty.textContent = "No global data available.";
    root.appendChild(empty);
    return root;
  }

  const champEntries = Object.entries(stats.champions)
    .map(([id, d]) => ({
      id,
      name: CHAMPION_DATA[id] || `Champion ${id}`,
      games: d.games,
      wins: d.wins,
      losses: d.games - d.wins,
      kills: d.kills,
      deaths: d.deaths,
      assists: d.assists,
      dmg: d.dmg,
    }))
    .sort((a, b) => b.games - a.games);

  const grid = buildChampionGridView(
    champEntries,
    champGames,
    champItemStats,
    champAugStats,
    onChampClick,
  );
  root.appendChild(grid);
  return root;
}

/**
 * Shared champion grid + detail view builder.
 * Used by both renderSpecificChampionsTab and renderGlobalChampionsTab.
 */
function buildChampionGridView(
  champEntries,
  champGames,
  champItemStats,
  champAugStats,
  onChampClick,
) {
  const root = document.createElement("div");
  root.className = "sc-root";

  const searchView = document.createElement("div");
  searchView.className = "sc-search-view";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "sc-search-input";
  searchInput.placeholder = "Search champions…";
  searchInput.spellcheck = false;
  searchInput.autocomplete = "off";
  searchView.appendChild(searchInput);

  const grid = document.createElement("div");
  grid.className = "sc-champion-grid";
  searchView.appendChild(grid);

  root.appendChild(searchView);

  let currentSort = "games";

  const controlsRow = document.createElement("div");
  controlsRow.className = "sc-controls-row";

  const sortWrap = document.createElement("div");
  sortWrap.className = "sc-sort-wrap";
  sortWrap.innerHTML = '<span class="sc-sort-label">Sort by:</span>';

  const pillContainer = document.createElement("div");
  pillContainer.className = "sc-pill-container";

  const sortOptions =[
    { label: "Games", key: "games" },
    { label: "Win %", key: "winRate" },
    { label: "KDA", key: "kda" },
    { label: "Avg Dmg", key: "dmg" },
  ];

  sortOptions.forEach((opt) => {
    const pill = document.createElement("div");
    pill.className = `sc-pill ${currentSort === opt.key ? "active" : ""}`;
    pill.textContent = opt.label;
    pill.onclick = () => {
      if (currentSort === opt.key) return;
      currentSort = opt.key;
      pillContainer
        .querySelectorAll(".sc-pill")
        .forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      renderGrid(searchInput.value.trim());
    };
    pillContainer.appendChild(pill);
  });

  sortWrap.appendChild(pillContainer);
  controlsRow.appendChild(sortWrap);
  searchView.insertBefore(controlsRow, grid);

  function renderGrid(query) {
    grid.innerHTML = "";

    let filtered = champEntries.filter((c) => champMatchesQuery(c.name, query));

    // Sorting logic
    filtered.sort((a, b) => {
      if (currentSort === "games") {
        return b.games - a.games;
      } else if (currentSort === "winRate") {
        const wrA = smoothedWinRate(a.wins, a.games);
        const wrB = smoothedWinRate(b.wins, b.games);
        return wrB - wrA;
      } else if (currentSort === "kda") {
        const kdaA = (a.kills + a.assists) / Math.max(1, a.deaths);
        const kdaB = (b.kills + b.assists) / Math.max(1, b.deaths);
        return kdaB - kdaA;
      } else if (currentSort === "dmg") {
        const dmgA = a.dmg / Math.max(1, a.games);
        const dmgB = b.dmg / Math.max(1, b.games);
        return dmgB - dmgA;
      }
      return 0;
    });

    filtered.forEach((c) => {
      const cell = document.createElement("div");
      cell.className = "sc-champ-cell";
      cell.title = `${c.name} — ${c.games} game${c.games !== 1 ? "s" : ""}`;
      cell.innerHTML = `
                <img src="/lol-game-data/assets/v1/champion-icons/${c.id}.png" class="sc-champ-icon" alt="${c.name}">
                <span class="sc-champ-name">${c.name}</span>
                <span class="sc-champ-games">${c.games}g</span>
            `;
      cell.onclick = () => showChampDetail(c);
      grid.appendChild(cell);
    });
  }

  searchInput.addEventListener("input", () =>
    renderGrid(searchInput.value.trim()),
  );
  renderGrid("");

  function showChampDetail(c) {
    const games = champGames[c.id] || [];
    const cAugStats = champAugStats[c.id] || {};
    const cItemStats = champItemStats[c.id] || {};

    const detailView = buildChampDetailView(
      c,
      games,
      cAugStats,
      cItemStats,
      () => {
        detailView.remove();
        searchView.classList.remove("sc-hidden");
      },
      onChampClick,
    );

    searchView.classList.add("sc-hidden");
    root.appendChild(detailView);
  }

  return root;
}

//  Shared stats renderer
/**
 * Renders the full tabbed stats interface into any target element.
 * Used by both the match history modal and the investigator dashboard.
 */
export async function renderStatsInto(
  targetEl,
  _finalStats,
  fullHistory,
  opts = {},
) {
  const {
    showClose = false,
    showHome = false,
    onHome = null,
    onClose = null,
    title = "Mayhem Analysis",
  } = opts;
  const uid = `aram-tabs-${Date.now()}`;
  const doc = targetEl.ownerDocument || document;

  await loadSettings();
  checkForUpdates();

  // Champion Filter State
  const selectedChamps = new Set();

    targetEl.innerHTML = `
        <div class="aram-modal-tools">
            ${showHome ? '<div class="aram-modal-home" title="Return to Dashboard"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg></div>' : ""}
            ${showClose ? '<div class="aram-modal-close" title="Close">&times;</div>' : ""}
        </div>
        <h2>${title}</h2>
        <div class="aram-tab-bar">
            <div class="aram-tab-item active"    data-tab="${uid}-general">General Stats</div>
            <div class="aram-tab-item"            data-tab="${uid}-history" id="${uid}-tab-history">Match History</div>
            <div class="aram-tab-item"            data-tab="${uid}-champions">Player's Champions</div>
            <div class="aram-tab-item"            data-tab="${uid}-global">Global Champions</div>
            <div class="aram-tab-item"            data-tab="${uid}-settings">Settings</div>
        </div>
        <div id="${uid}-general"   class="aram-tab-content active"></div>
        <div id="${uid}-history"   class="aram-tab-content"></div>
        <div id="${uid}-champions" class="aram-tab-content"></div>
        <div id="${uid}-global"    class="aram-tab-content"></div>
        <div id="${uid}-settings"  class="aram-tab-content"></div>
    `;

  const switchTab = (tabId) => {
    const tabItem = targetEl.querySelector(`[data-tab="${uid}-${tabId}"]`);
    if (tabItem) tabItem.click();
  };

  targetEl.style.position = "relative";

  const footer = doc.createElement("div");
  footer.className = "aram-credits";
  footer.innerHTML = "Mayhem Doctor &nbsp;&middot;&nbsp; by Reformed Doge";
  targetEl.appendChild(footer);

  targetEl.querySelectorAll(".aram-tab-item").forEach((tab) => {
    tab.onclick = () => {
      targetEl
        .querySelector(".aram-tab-item.active")
        .classList.remove("active");
      targetEl
        .querySelector(".aram-tab-content.active")
        .classList.remove("active");
      tab.classList.add("active");
      targetEl.querySelector(`#${tab.dataset.tab}`).classList.add("active");
    };
  });

  if (showClose) {
    targetEl.querySelector(".aram-modal-close").onclick =
      typeof onClose === "function"
        ? onClose
        : () => targetEl.parentElement?.remove();
  }

  if (showHome && onHome) {
    targetEl.querySelector(".aram-modal-home").onclick = onHome;
  }

  function buildStats(excluded) {
    const filtered =
      excluded.size === 0
        ? fullHistory
        : fullHistory.filter((h) => !excluded.has(toPatchLabel(h.gameVersion)));
    const stats = {
      wins: 0,
      losses: 0,
      remakes: 0,
      champions: {},
      items: {},
      augments: {},
    };
    filtered.forEach((h) => accumulateStats(stats, h));
    return { stats, filtered };
  }

  function renderTabs(excluded) {
    const { stats, filtered } = buildStats(excluded);
    const generalEl = targetEl.querySelector(`#${uid}-general`);
    const historyEl = targetEl.querySelector(`#${uid}-history`);
    const championsEl = targetEl.querySelector(`#${uid}-champions`);
    const globalEl = targetEl.querySelector(`#${uid}-global`);

    const refreshHistory = () => {
      historyEl.innerHTML = "";
      historyEl.appendChild(
        renderHistoryTab(filtered, selectedChamps, refreshHistory, doc),
      );
    };

    generalEl.innerHTML = "";
    championsEl.innerHTML = "";
    globalEl.innerHTML = "";

    const handleChampFilter = (cId) => {
      selectedChamps.clear();
      selectedChamps.add(String(cId));
      refreshHistory();
      switchTab("history");
    };

    generalEl.appendChild(renderGeneralTab(stats, handleChampFilter));
    refreshHistory();

    championsEl.appendChild(
      renderSpecificChampionsTab(stats, filtered, handleChampFilter),
    );

    globalEl.appendChild(renderGlobalChampionsTab(filtered));
  }

  // Settings tab is patch-filter-independent, mount once
  const settingsEl = targetEl.querySelector(`#${uid}-settings`);
  settingsEl.appendChild(renderSettingsTab());

  const allVersions = fullHistory.map((h) => h.gameVersion || "");
  const { el: filterEl, excludedSet } = await createPatchFilter(
    allVersions,
    (excluded) => {
      renderTabs(excluded);
    },
    doc,
  );
  const toolsContainer = targetEl.querySelector(".aram-modal-tools");
  if (toolsContainer) {
    toolsContainer.prepend(filterEl);
  } else {
    targetEl.appendChild(filterEl);
  }

  renderTabs(excludedSet);
}
