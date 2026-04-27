/**
 * Item combo analysis (sequential build paths) + dom renderers.
 */

import { ITEM_DATA } from '../lcu.js';
import { smoothedWinRate } from '../analysis.js';
import { createInteractiveTable } from './table.js';

//  Item chip 
export function itemChip(id) {
    const info = ITEM_DATA[id] || { name: `Item ${id}`, icon: '' };
    return `
        <div class="sc-combo-chip sc-combo-chip--icon-only">
            ${info.icon
                ? `<img src="${info.icon}" class="aram-icon" title="${info.name}">`
                : `<span class="sc-combo-name">${info.name}</span>`}
        </div>
    `;
}

//  Combo analysis 
/**
 * Finds the top N sequential item build paths of exactly `size` items.
 * Respects pre-sorted orderedBuild from parseGame / deriveOrderedBuild.
 * Win rates are Laplace-smoothed so small-n combos don't dominate.
 */
export function buildSeenItemCombos(games, size, topN = 3, minGames = 2) {
    const map = {};
    games.forEach(g => {
        const items = g.orderedBuild || [];
        if (items.length < size) return;
        const combos = [];
        function helper(start, current) {
            if (current.length === size) { combos.push([...current]); return; }
            for (let i = start; i < items.length; i++) {
                current.push(items[i]);
                helper(i + 1, current);
                current.pop();
            }
        }
        helper(0, []);
        combos.forEach(combo => {
            const key = combo.join('>');
            if (!map[key]) map[key] = { ids: combo, games: 0, wins: 0 };
            map[key].games++;
            if (g.win) map[key].wins++;
        });
    });
    return Object.values(map)
        .filter(d => d.games >= minGames)
        .map(d => ({ ...d, winRate: smoothedWinRate(d.wins, d.games) }))
        .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
        .slice(0, topN);
}

//  Card renderer 
export function renderItemComboCards(combos, size) {
    if (combos.length === 0) {
        const p = document.createElement('p');
        p.className = 'sc-empty';
        p.textContent = `Not enough data — need ≥2 games with the same ${size}-item build path.`;
        return p;
    }
    const wrap = document.createElement('div');
    wrap.className = 'sc-combo-cards';
    combos.forEach((combo, rank) => {
        const card = document.createElement('div');
        card.className = 'sc-combo-card';
        const wrClass = combo.winRate >= 60 ? 'aram-win-high' : combo.winRate <= 40 ? 'aram-win-low' : 'aram-winrate';
        const chips = combo.ids.map(id => itemChip(id)).join('<span class="sc-combo-arrow" style="opacity:0.6; margin:0 4px; font-size:12px;">&#10132;</span>');
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

//  Item section builder (Specific Champions tab) 
/**
 * Builds the full item panel for a champion detail view.
 * Returns a ready-to-append .sc-item-section element.
 */
export function buildItemSection(games, cItemStats) {
    const itemSection = document.createElement('div');
    itemSection.className = 'sc-item-section';

    const comboSections = [
        { title: 'Best Build Pairs',        size: 2 },
        { title: 'Best 3-Item Build Paths', size: 3 },
        { title: 'Best 4-Item Build Paths', size: 4 }
    ];
    comboSections.forEach((section, i) => {
        const subTitle = document.createElement('h3');
        subTitle.className = `sc-section-title${i > 0 ? ' sc-section-title--pairs' : ''}`;
        subTitle.textContent = section.title;
        itemSection.appendChild(subTitle);
        const combos = buildSeenItemCombos(games, section.size, 3, 2);
        itemSection.appendChild(renderItemComboCards(combos, section.size));
    });

    const itemTableTitle = document.createElement('h3');
    itemTableTitle.className = 'sc-section-title sc-section-title--pairs';
    itemTableTitle.textContent = 'Individual Items (Final Build)';
    itemSection.appendChild(itemTableTitle);

    const itemRows = Object.entries(cItemStats).map(([iId, d]) => {
        const info = ITEM_DATA[iId] || { name: `Item ${iId}`, icon: '' };
        return { id: iId, name: info.name, icon: info.icon, ...d, winRate: smoothedWinRate(d.wins, d.games) };
    }).sort((a, b) => b.games - a.games);

    if (itemRows.length === 0) {
        const p = document.createElement('p'); p.className = 'sc-empty'; p.textContent = 'No item data.';
        itemSection.appendChild(p);
    } else {
        itemSection.appendChild(createInteractiveTable([
            { label: 'Item',  key: 'name',    render: r => `<div class="aram-icon-cell">${r.icon ? `<img src="${r.icon}" class="aram-icon">` : ''} ${r.name}</div>` },
            { label: 'Built', key: 'games' },
            { label: 'Win %', key: 'winRate', render: r => `<span class="${r.winRate >= 60 ? 'aram-win-high' : r.winRate <= 40 ? 'aram-win-low' : ''}">${r.winRate.toFixed(1)}%</span>` }
        ], itemRows, 'games'));
    }

    return itemSection;
}
