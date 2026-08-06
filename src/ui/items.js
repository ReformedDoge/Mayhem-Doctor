/**
 * Item combo analysis (sequential build paths) + dom renderers.
 */

import { ITEM_DATA } from "../lcu.js";
import {
  smoothedWinRate,
  analyzeChampBuildPath,
  getWRColor,
} from "../analysis.js";
import { createInteractiveTable } from "./table.js";
import { BLACKLIST_ITEM_IDS } from "../config.js";

// Item chip
export function itemChip(id) {
  const info = ITEM_DATA[id] || { name: `Item ${id}`, icon: "" };
  return `
        <div class="sc-combo-chip sc-combo-chip--icon-only">
            ${
              info.icon
                ? `<img src="${info.icon}" class="aram-icon" title="${info.name}">`
                : `<span class="sc-combo-name">${info.name}</span>`
            }
        </div>
    `;
}

// Combo analysis
/**
 * Finds the top N unordered item cores of exactly `size` items.
 * Aggregates build paths (A>B and B>A) into a single core for better sample size.
 * Win rates are Laplace-smoothed so small-n combos don't dominate.
 */
export function buildSeenItemCombos(games, size, topN = 3, minGames = 2) {
  const map = {};
  games.forEach((g) => {
    // Filter, deduplicate, and sort items to ensure unordered aggregation
    const items = [...new Set(g.orderedBuild || [])]
      .filter((id) => !BLACKLIST_ITEM_IDS.has(Number(id)))
      .sort((a, b) => a - b);

    if (items.length < size) return;
    const combos = [];
    function helper(start, current) {
      if (current.length === size) {
        combos.push([...current]);
        return;
      }
      for (let i = start; i < items.length; i++) {
        current.push(items[i]);
        helper(i + 1, current);
        current.pop();
      }
    }
    helper(0, []);
    combos.forEach((combo) => {
      const key = combo.join("+");
      if (!map[key]) map[key] = { ids: combo, games: 0, wins: 0 };
      map[key].games++;
      if (g.win) map[key].wins++;
    });
  });

  return Object.values(map)
    .filter((d) => d.games >= minGames)
    .map((d) => {
      const wr = smoothedWinRate(d.wins, d.games);
      return {
        ...d,
        winRate: wr,
        priority: wr + Math.log(Math.max(1, d.games)) * 5,
      };
    })
    .filter((d) => d.games >= Math.max(2, games.length * 0.01))
    .sort((a, b) => b.priority - a.priority || b.games - a.games)
    .slice(0, topN);
}

// Card renderer
export function renderItemComboCards(combos, size) {
  if (combos.length === 0) {
    const p = document.createElement("p");
    p.className = "sc-empty";
    p.textContent = `Not enough data - need ≥2 games with the same ${size}-item core.`;
    return p;
  }
  const wrap = document.createElement("div");
  wrap.className = "sc-combo-cards";
  combos.forEach((combo, rank) => {
    const card = document.createElement("div");
    card.className = "sc-combo-card";
    const wrClass =
      combo.winRate >= 60
        ? "aram-win-high"
        : combo.winRate <= 40
          ? "aram-win-low"
          : "aram-winrate";
    const chips = combo.ids
      .map((id) => itemChip(id))
      .join(
        '<span class="sc-combo-separator" style="opacity:0.4; margin:0 6px; font-size:14px; font-weight:800;">+</span>',
      );
    card.innerHTML = `
            <div class="sc-combo-rank">#${rank + 1}</div>
            <div class="sc-combo-chips">${chips}</div>
            <div class="sc-combo-meta">
                <span class="${wrClass}">${combo.winRate.toFixed(1)}%</span>
                <span class="sc-combo-games">${combo.games}g</span>
            </div>`;
    wrap.appendChild(card);
  });
  return wrap;
}

// Item section builder (Specific Champions tab)
/**
 * Builds the full item panel for a champion detail view.
 * Returns a ready-to-append .sc-item-section element.
 */
export function buildItemSection(games, cItemStats) {
  const itemSection = document.createElement("div");
  itemSection.className = "sc-item-section";

  const architect = buildArchitectSection(games, cItemStats);
  if (architect) {
    itemSection.appendChild(architect);
  }

  const comboSections = [
    { title: "Best Build Pairs", size: 2 },
    { title: "Best SEEN 3-Item Cores", size: 3 },
    { title: "Best SEEN 4-Item Cores", size: 4 },
  ];
  comboSections.forEach((section) => {
    const subTitle = document.createElement("h3");
    subTitle.className = `sc-section-title sc-section-title--pairs`;
    subTitle.textContent = section.title;
    itemSection.appendChild(subTitle);
    const combos = buildSeenItemCombos(games, section.size, 3, 2);
    itemSection.appendChild(renderItemComboCards(combos, section.size));
  });

  const itemTableTitle = document.createElement("h3");
  itemTableTitle.className = "sc-section-title sc-section-title--pairs";
  itemTableTitle.textContent = "Individual Items (Final Build)";
  itemSection.appendChild(itemTableTitle);

  const itemRows = Object.entries(cItemStats)
    .filter(([id]) => !BLACKLIST_ITEM_IDS.has(Number(id)))
    .map(([iId, d]) => {
      const info = ITEM_DATA[iId] || { name: `Item ${iId}`, icon: "" };
      return {
        id: iId,
        name: info.name,
        icon: info.icon,
        ...d,
        winRate: smoothedWinRate(d.wins, d.games),
      };
    })
    .sort((a, b) => b.games - a.games);

  if (itemRows.length === 0) {
    const p = document.createElement("p");
    p.className = "sc-empty";
    p.textContent = "No item data.";
    itemSection.appendChild(p);
  } else {
    itemSection.appendChild(
      createInteractiveTable(
        [
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
        itemRows,
        "games",
      ),
    );
  }

  return itemSection;
}

/**
 * Renders the Build Paths section for a specific champion.
 * Owns the synergyWeight state locally so adjustments are scoped to this
 * champion view and do not bleed into other concurrent renders.
 */
function buildArchitectSection(games, cItemStats) {
  const root = document.createElement("div");
  root.className = "sc-architect-root";

  // Local weight - does not mutate the global SETTINGS object
  let synergyWeight = 0.3;

  function renderInner() {
    const buildInfo = analyzeChampBuildPath(games, cItemStats, synergyWeight);

    if (!buildInfo || !buildInfo.paths.length) {
      root.innerHTML = `<p class="sc-empty">Not enough data for build paths.</p>`;
      return;
    }

    const allItemWrs = [];
    buildInfo.paths.forEach((p) =>
      p.items.forEach((i) => allItemWrs.push(i.wr)),
    );
    buildInfo.rankedBoots.forEach((b) => allItemWrs.push(b.wr));
    const maxWR = allItemWrs.length ? Math.max(...allItemWrs) : 50;
    const minWR = allItemWrs.length ? Math.min(...allItemWrs) : 50;

    root.innerHTML = "";

    const tuner = document.createElement("div");
    tuner.className = "sc-arch-tuner";
    tuner.innerHTML = `
            <div class="sc-arch-tuner-meta">
                <span class="sc-arch-tuner-title">BUILD PATHS</span>
                <span class="sc-arch-tuner-desc">Tuning: <b id="synergy-label">${(100 - synergyWeight * 100).toFixed(0)}% Power / ${(synergyWeight * 100).toFixed(0)}% Synergy</b></span>
            </div>
            <div class="sc-arch-tuner-controls">
                <input type="range" min="0" max="80" value="${synergyWeight * 100}" class="sc-arch-tuner-slider">
                <button class="sc-arch-tuner-btn aram-btn-start">Apply</button>
            </div>
        `;
    const slider = tuner.querySelector("input");
    const label = tuner.querySelector("#synergy-label");
    const btn = tuner.querySelector("button");

    slider.oninput = (e) => {
      const val = parseInt(e.target.value);
      label.textContent = `${100 - val}% Power / ${val}% Synergy`;
    };

    btn.onclick = () => {
      synergyWeight = parseInt(slider.value) / 100;
      renderInner();
    };
    root.appendChild(tuner);

    const mainRow = document.createElement("div");
    mainRow.className = "sc-architect-main";
    const pathsWrap = document.createElement("div");
    pathsWrap.className = "sc-architect-paths";

    buildInfo.paths.forEach((p) => {
      const pathRow = document.createElement("div");
      pathRow.className = "sc-arch-path-row";
      pathRow.innerHTML = `<div class="sc-arch-path-label">${p.label}</div>`;
      const itemsGrid = document.createElement("div");
      itemsGrid.className = "sc-arch-items-grid";
      p.items.forEach((item, idx) => {
        const itemData = ITEM_DATA[item.id];
        const color = getWRColor(item.wr, minWR, maxWR);
        itemsGrid.innerHTML += `
          <div class="sc-arch-item-box">
            <img src="${itemData?.icon || ""}" class="sc-arch-item-icon" title="${itemData?.name || ""}">
            <div class="sc-arch-item-wr" style="color: ${color}">${item.wr.toFixed(0)}%</div>
          </div>${idx < p.items.length - 1 ? '<div class="sc-arch-arrow">→</div>' : ""}`;
      });
      pathRow.appendChild(itemsGrid);
      pathsWrap.appendChild(pathRow);
    });
    mainRow.appendChild(pathsWrap);
    root.appendChild(mainRow);

    // THE BOOTS SECTION
    if (buildInfo.rankedBoots.length > 0) {
      const bootsWrap = document.createElement("div");
      bootsWrap.className = "sc-architect-boots-compact";
      bootsWrap.innerHTML = `<div class="sc-arch-path-label-inline">Boots:</div>`;
      const bootsGrid = document.createElement("div");
      bootsGrid.className = "sc-arch-boots-row";

      buildInfo.rankedBoots.forEach((b) => {
        const itemData = ITEM_DATA[b.id];
        const color = getWRColor(b.wr, minWR, maxWR);
        bootsGrid.innerHTML += `
          <div class="sc-arch-boot-mini">
            <img src="${itemData?.icon || ""}" class="sc-arch-boot-icon-mini" title="${itemData?.name || ""}">
            <div class="sc-arch-boot-wr-mini" style="color: ${color}">${b.wr.toFixed(0)}%</div>
          </div>`;
      });
      bootsWrap.appendChild(bootsGrid);
      root.appendChild(bootsWrap);
    }
  }

  renderInner();
  return root;
}
