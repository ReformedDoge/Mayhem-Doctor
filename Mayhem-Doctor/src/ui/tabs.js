/**
 * The three main tab renderers (General, Match History, Specific Champions)
 * and renderStatsInto which mounts them into any target element.
 */

import { CHAMPION_DATA, AUGMENT_DATA, ITEM_DATA } from '../lcu.js';
import { accumulateStats } from '../analysis.js';
import { createInteractiveTable } from './table.js';
import { openAramMatchView } from './matchView.js';
import { buildAugSection } from './augments.js';
import { buildItemSection } from './items.js';
import { createPatchFilter, toPatchLabel } from './patchFilter.js';

//  Champion name fuzzy matching 
function normaliseChampName(name) {
    return name.toLowerCase().replace(/['\s]/g, '');
}

function champMatchesQuery(champName, query) {
    if (!query) return true;
    const q        = normaliseChampName(query);
    const name     = champName.toLowerCase();
    const nameNorm = normaliseChampName(champName);
    if (nameNorm.startsWith(q)) return true;
    const words = name.split(/[\s']/);
    if (words.some(w => w.startsWith(q))) return true;
    return false;
}

//  General tab 
export function renderGeneralTab(stats) {
    const container = document.createElement('div');
    const totalGames = stats.wins + stats.losses;
    const winRate    = totalGames > 0 ? (stats.wins / totalGames * 100).toFixed(1) : 0;
    const remakeStr  = stats.remakes > 0
        ? ` &bull; <span class="aram-remake-count">${stats.remakes} Remake${stats.remakes > 1 ? 's' : ''}</span>`
        : '';

    const summary = document.createElement('div');
    summary.className = 'aram-summary-bar';
    summary.innerHTML = `Analyzed: <b>${totalGames}</b> Valid Games &bull; <span class="aram-win-high">${stats.wins}W</span> <span class="aram-dash">-</span> <span class="aram-win-low">${stats.losses}L</span> <span class="aram-winrate">(${winRate}%)</span>${remakeStr}`;
    container.appendChild(summary);

    const makeHeader = (text) => { const h = document.createElement('h3'); h.textContent = text; return h; };

    const champData = Object.entries(stats.champions).map(([id, d]) => ({
        id, name: CHAMPION_DATA[id] || `ID ${id}`, ...d,
        winRate: d.wins / d.games * 100,
        kda:     (d.kills + d.assists) / Math.max(1, d.deaths),
        avgDmg:  d.dmg / d.games
    }));
    container.appendChild(makeHeader('Champions'));
    container.appendChild(createInteractiveTable([
        { label: 'Champion', key: 'name',    render: r => `<div class="aram-icon-cell"><img src="/lol-game-data/assets/v1/champion-icons/${r.id}.png" class="aram-icon"> ${r.name}</div>` },
        { label: 'Games',    key: 'games' },
        { label: 'Win %',    key: 'winRate', render: r => `<span class="${r.winRate >= 60 ? 'aram-win-high' : r.winRate <= 40 ? 'aram-win-low' : ''}">${r.winRate.toFixed(1)}%</span>` },
        { label: 'KDA',      key: 'kda',     render: r => r.kda.toFixed(2) },
        { label: 'Avg Dmg',  key: 'avgDmg',  render: r => r.avgDmg.toLocaleString('en', { maximumFractionDigits: 0 }) }
    ], champData, 'games'));

    const augData = Object.entries(stats.augments)
        .map(([id, d]) => ({ id, name: (AUGMENT_DATA[id] || { name: `Augment ${id}` }).name, icon: (AUGMENT_DATA[id] || { icon: '' }).icon, ...d, winRate: d.wins / d.games * 100 }))
        .filter(d => d.games >= 2);
    container.appendChild(makeHeader('Augments (min 2 picks)'));
    container.appendChild(createInteractiveTable([
        { label: 'Augment', key: 'name',    render: r => `<div class="aram-icon-cell">${r.icon ? `<img src="${r.icon}" class="aram-icon">` : ''} ${r.name}</div>` },
        { label: 'Picked',  key: 'games' },
        { label: 'Win %',   key: 'winRate', render: r => `<span class="${r.winRate >= 60 ? 'aram-win-high' : r.winRate <= 40 ? 'aram-win-low' : ''}">${r.winRate.toFixed(1)}%</span>` }
    ], augData, 'games'));

    const itemData = Object.entries(stats.items)
        .map(([id, d]) => ({ id, name: (ITEM_DATA[id] || { name: `Item ${id}` }).name, icon: (ITEM_DATA[id] || { icon: '' }).icon, ...d, winRate: d.wins / d.games * 100 }))
        .filter(d => d.games >= 2);
    container.appendChild(makeHeader('Items (min 2 builds)'));
    container.appendChild(createInteractiveTable([
        { label: 'Item',  key: 'name',    render: r => `<div class="aram-icon-cell">${r.icon ? `<img src="${r.icon}" class="aram-icon">` : ''} ${r.name}</div>` },
        { label: 'Built', key: 'games' },
        { label: 'Win %', key: 'winRate', render: r => `<span class="${r.winRate >= 60 ? 'aram-win-high' : r.winRate <= 40 ? 'aram-win-low' : ''}">${r.winRate.toFixed(1)}%</span>` }
    ], itemData, 'games'));

    return container;
}

//  Match history tab 
export function renderHistoryTab(history) {
    const container = document.createElement('div');
    const historyData = history.map(h => ({
        ...h,
        resultDisplay:   h.result === 'Win' ? '✅ Win' : (h.result === 'Loss' ? '❌ Loss' : '🔄 Remake'),
        durationDisplay: `${Math.floor(h.gameDuration / 60)}m ${h.gameDuration % 60}s`
    }));
    container.appendChild(createInteractiveTable([
        { label: 'Result',   key: 'resultDisplay',  render: r => `<span class="${r.result === 'Win' ? 'aram-win-high' : r.result === 'Loss' ? 'aram-win-low' : 'remake-indicator'}">${r.resultDisplay}</span>` },
        { label: 'Champion', key: 'championName',   render: r => `<div class="aram-icon-cell"><img src="/lol-game-data/assets/v1/champion-icons/${r.championId}.png" class="aram-icon"> ${r.championName}</div>` },
        { label: 'KDA',      key: 'kda' },
        { label: 'Damage',   key: 'dmg',            render: r => r.dmg.toLocaleString() },
        { label: 'Duration', key: 'gameDuration',   render: r => r.durationDisplay },
        { label: 'Items',    key: 'items',           render: r => r.items.map(id => ITEM_DATA[id] ? `<img src="${ITEM_DATA[id].icon}" class="aram-icon" title="${ITEM_DATA[id].name}">` : '').join('') },
        { label: '',         key: 'gameVersion',     render: r => `<span class="aram-version-badge" title="${r.gameVersion}">!</span>` }
    ], historyData, 'gameCreation', false,
    (row, e) => {
        const targetContainer = e.target.closest('.aram-modal-content, #mi-results');
        openAramMatchView(row.rawGame, targetContainer);
    }));
    return container;
}

//  Specific Champions tab 
export function renderSpecificChampionsTab(stats, fullHistory) {
    const root = document.createElement('div');
    root.className = 'sc-root';

    const champEntries = Object.entries(stats.champions).map(([id, d]) => ({
        id,
        name:    CHAMPION_DATA[id] || `Champion ${id}`,
        games:   d.games,
        wins:    d.wins,
        losses:  d.games - d.wins,
        kills:   d.kills,
        deaths:  d.deaths,
        assists: d.assists,
        dmg:     d.dmg,
    })).sort((a, b) => b.games - a.games);

    // Build per-champion stat indexes from fullHistory
    const champItemStats = {};
    const champAugStats  = {};
    const champGames     = {};
    fullHistory.forEach(h => {
        if (h.result === 'Remake') return;
        const cId      = String(h.championId);
        const win      = h.result === 'Win';
        const augments = (h.augments || []).map(Number).filter(Boolean);
        const items    = (h.items    || []).map(Number).filter(Boolean);

        if (!champItemStats[cId]) champItemStats[cId] = {};
        items.forEach(iId => {
            if (!champItemStats[cId][iId]) champItemStats[cId][iId] = { games: 0, wins: 0 };
            champItemStats[cId][iId].games++; if (win) champItemStats[cId][iId].wins++;
        });

        if (!champAugStats[cId]) champAugStats[cId] = {};
        augments.forEach(aId => {
            if (!champAugStats[cId][aId]) champAugStats[cId][aId] = { games: 0, wins: 0 };
            champAugStats[cId][aId].games++; if (win) champAugStats[cId][aId].wins++;
        });

        if (!champGames[cId]) champGames[cId] = [];
        champGames[cId].push({ win, items, augments, orderedBuild: h.orderedBuild });
    });

    // Search view
    const searchView  = document.createElement('div');
    searchView.className = 'sc-search-view';
    const searchInput = document.createElement('input');
    searchInput.type         = 'text';
    searchInput.className    = 'sc-search-input';
    searchInput.placeholder  = "Search champions… (e.g. kog, maw, kog'maw)";
    searchInput.spellcheck   = false;
    searchInput.autocomplete = 'off';
    searchView.appendChild(searchInput);
    const grid = document.createElement('div');
    grid.className = 'sc-champion-grid';
    searchView.appendChild(grid);

    const detailView = document.createElement('div');
    detailView.className = 'sc-detail-view sc-hidden';

    root.appendChild(searchView);
    root.appendChild(detailView);

    function renderGrid(query) {
        grid.innerHTML = '';
        const filtered = champEntries.filter(c => champMatchesQuery(c.name, query));
        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className   = 'sc-no-results';
            empty.textContent = 'No champions found.';
            grid.appendChild(empty);
            return;
        }
        filtered.forEach(c => {
            const cell = document.createElement('div');
            cell.className = 'sc-champ-cell';
            cell.title     = `${c.name} — ${c.games} game${c.games !== 1 ? 's' : ''}`;
            cell.innerHTML  = `
                <img src="/lol-game-data/assets/v1/champion-icons/${c.id}.png" class="sc-champ-icon" alt="${c.name}">
                <span class="sc-champ-name">${c.name}</span>
                <span class="sc-champ-games">${c.games}g</span>
            `;
            cell.addEventListener('click', () => showChampDetail(c));
            grid.appendChild(cell);
        });
    }

    searchInput.addEventListener('input', () => renderGrid(searchInput.value.trim()));
    renderGrid('');

    function showChampDetail(c) {
        searchView.classList.add('sc-hidden');
        detailView.classList.remove('sc-hidden');
        detailView.innerHTML = '';

        const totalGames = c.games;
        const wr      = totalGames > 0 ? (c.wins / totalGames * 100).toFixed(1) : 0;
        const wrClass = parseFloat(wr) >= 60 ? 'aram-win-high' : parseFloat(wr) <= 40 ? 'aram-win-low' : 'aram-winrate';
        const kdaVal  = ((c.kills + c.assists) / Math.max(1, c.deaths)).toFixed(2);
        const avgDmg  = totalGames > 0 ? Math.round(c.dmg / totalGames).toLocaleString() : '—';

        const backBtn = document.createElement('button');
        backBtn.className   = 'sc-back-btn aram-btn-start';
        backBtn.textContent = '← Back to Champions';
        backBtn.addEventListener('click', () => { detailView.classList.add('sc-hidden'); searchView.classList.remove('sc-hidden'); });
        detailView.appendChild(backBtn);

        const header = document.createElement('div');
        header.className = 'sc-detail-header';
        header.innerHTML = `
            <img src="/lol-game-data/assets/v1/champion-icons/${c.id}.png" class="sc-detail-icon" alt="${c.name}">
            <div class="sc-detail-title">
                <div class="sc-detail-champ-name">${c.name}</div>
                <div class="sc-detail-stats">
                    <span class="aram-win-high">${c.wins}W</span> <span class="aram-dash"> — </span> <span class="aram-win-low">${c.losses}L</span>
                    <span class="aram-dash"> &bull; </span> <span class="${wrClass}">${wr}% WR</span> <span class="aram-dash"> &bull; </span>
                    <span class="sc-total-games">${totalGames} Total Game${totalGames !== 1 ? 's' : ''}</span> <span class="aram-dash"> &bull; </span>
                    <span class="sc-kda-label">KDA: <b>${kdaVal}</b></span> <span class="aram-dash"> &bull; </span>
                    <span class="sc-dmg-label">Avg Dmg: <b>${avgDmg}</b></span>
                </div>
            </div>`;
        detailView.appendChild(header);

        const games      = champGames[c.id]      || [];
        const cAugStats  = champAugStats[c.id]   || {};
        const cItemStats = champItemStats[c.id]  || {};

        const mainRow = document.createElement('div');
        mainRow.className = 'sc-detail-cols';
        mainRow.appendChild(buildAugSection(games, cAugStats, totalGames));
        mainRow.appendChild(buildItemSection(games, cItemStats));
        detailView.appendChild(mainRow);
    }

    return root;
}

//  Shared stats renderer 
/**
 * Renders the full tabbed stats interface into any target element.
 * Used by both the match history modal and the investigator dashboard.
 *
 * Mounts a floating patch filter; on filter change it re-derives stats from
 * fullHistory and re-renders all three tab content areas in place.
 */
export async function renderStatsInto(targetEl, _finalStats, fullHistory, opts = {}) {
    const { showClose = false, title = 'Mayhem Analysis' } = opts;
    const uid = `aram-tabs-${Date.now()}`;

    targetEl.innerHTML = `
        ${showClose ? '<div class="aram-modal-close">&times;</div>' : ''}
        <h2>${title}</h2>
        <div class="aram-tab-bar">
            <div class="aram-tab-item active" data-tab="${uid}-general">General Stats</div>
            <div class="aram-tab-item" data-tab="${uid}-history">Full Match History</div>
            <div class="aram-tab-item" data-tab="${uid}-champions">Specific Champions</div>
        </div>
        <div id="${uid}-general"   class="aram-tab-content active"></div>
        <div id="${uid}-history"   class="aram-tab-content"></div>
        <div id="${uid}-champions" class="aram-tab-content"></div>
    `;

    // Keep the modal wrapper position:relative so the filter can float inside it
    targetEl.style.position = 'relative';

    // Credits footer
    const footer = document.createElement('div');
    footer.className = 'aram-credits';
    footer.innerHTML = 'Mayhem Doctor &nbsp;·&nbsp; by Reformed Doge';
    targetEl.appendChild(footer);

    targetEl.querySelectorAll('.aram-tab-item').forEach(tab => {
        tab.onclick = () => {
            targetEl.querySelector('.aram-tab-item.active').classList.remove('active');
            targetEl.querySelector('.aram-tab-content.active').classList.remove('active');
            tab.classList.add('active');
            targetEl.querySelector(`#${tab.dataset.tab}`).classList.add('active');
        };
    });

    if (showClose) {
        targetEl.querySelector('.aram-modal-close').onclick = () => targetEl.parentElement.remove();
    }

    //  Derive stats from a filtered history slice 
    function buildStats(excluded) {
        const filtered = excluded.size === 0
            ? fullHistory
            : fullHistory.filter(h => !excluded.has(toPatchLabel(h.gameVersion)));
        const stats = { wins: 0, losses: 0, remakes: 0, champions: {}, items: {}, augments: {} };
        filtered.forEach(h => accumulateStats(stats, h));
        return { stats, filtered };
    }

    //  Re-render all three tab content areas 
    function renderTabs(excluded) {
        const { stats, filtered } = buildStats(excluded);
        const generalEl   = targetEl.querySelector(`#${uid}-general`);
        const historyEl   = targetEl.querySelector(`#${uid}-history`);
        const championsEl = targetEl.querySelector(`#${uid}-champions`);

        generalEl.innerHTML   = '';
        historyEl.innerHTML   = '';
        championsEl.innerHTML = '';

        generalEl.appendChild(renderGeneralTab(stats));
        historyEl.appendChild(renderHistoryTab(filtered));
        championsEl.appendChild(renderSpecificChampionsTab(stats, filtered));
    }

    //  Mount patch filter 
    const allVersions = fullHistory.map(h => h.gameVersion || '');
    const { el: filterEl, excludedSet } = await createPatchFilter(allVersions, (excluded) => {
        renderTabs(excluded);
    });
    targetEl.appendChild(filterEl);

    // Initial render with persisted exclusions applied
    renderTabs(excludedSet);
}