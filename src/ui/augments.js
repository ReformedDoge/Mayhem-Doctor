/**
 * Augment analysis: tier rankings, seen pairs.
 * DOM renderers for element + rarity helpers.
 */

import { AUGMENT_DATA } from '../lcu.js';
import { smoothedWinRate, wilsonLowerBound } from '../analysis.js';
import { createInteractiveTable, attachTableSearch } from './table.js';

// Maps an augment WR relative to the champion baseline WR to a gradient color.
function augWrColor(augWr, champWr) {
    const delta = augWr - champWr; // positive = above baseline, negative = below
    const t = Math.max(-1, Math.min(1, delta / 10)); // clamp to [-1, 1] over a 10pp range

    if (t >= 0) {
        // gray (#aaa = 170,170,170) → bright green (#2de0a5 = 45,224,165)
        const r = Math.round(170 + (45  - 170) * t);
        const g = Math.round(170 + (224 - 170) * t);
        const b = Math.round(170 + (165 - 170) * t);
        return `rgb(${r},${g},${b})`;
    } else {
        // gray (#aaa = 170,170,170) → red (#e05c5c = 224,92,92)
        const abs = -t;
        const r = Math.round(170 + (224 - 170) * abs);
        const g = Math.round(170 + (92  - 170) * abs);
        const b = Math.round(170 + (92  - 170) * abs);
        return `rgb(${r},${g},${b})`;
    }
}

// Rarity helpers
export function getAugRarity(id) {
    const info = AUGMENT_DATA[id];
    if (!info) return 'kUnknown';
    return info.rarity || 'kUnknown';
}
export function rarityLabel(rarity) {
    return { kSilver: 'Silver', kGold: 'Gold', kPrismatic: 'Prismatic' }[rarity] || rarity;
}
export function rarityOrder(rarity) {
    return { kSilver: 0, kGold: 1, kPrismatic: 2 }[rarity] ?? -1;
}

/**
 * Identifies the top augments for each rarity tier.
 */

// Two-proportion z score between two augmenting win rates.
// Positive = b has the higher true-ish WR (given samples).
export function wrightZScore(aWins, aGames, bWins, bGames) {
    const pA = aWins / aGames;
    const pB = bWins / bGames;
    const se = Math.sqrt((pA * (1 - pA)) / aGames + (pB * (1 - pB)) / bGames);
    return se === 0 ? 0 : (pB - pA) / se;
}

// Sort tiers by Wilson LB, then break statistical ties by the larger sample.
// Consecutive Wilson-sorted entries whose observed WR difference is not
// significant (|z| < Z_EQUIV) form one cluster. Within a cluster, entries that
// beat the champion's baseline WR rank first, while entries below the baseline
// sink to the bottom.

const Z_EQUIV = 1.96; // 95% two-sided
const maturityFloorFor = totalGames => Math.max(48, Math.round(totalGames * 0.06));

function rankByWRAndSamples(items, champWr = 50, maturityFloor = maturityFloorFor(0)) {
    if (!items || items.length < 2) return items || [];
    items.sort((a, b) => b.priority - a.priority);

    const belowBaseline = x => (x.rawWr < champWr ? 1 : 0);
    const immature = x => (x.games < maturityFloor ? 1 : 0);
    const sortBucket = b => b.sort((a, x) => (
        (belowBaseline(a) - belowBaseline(x)) ||
        (immature(a) - immature(x)) ||
        (a.games >= maturityFloor ? x.rawWr - a.rawWr : 0) ||
        (x.games - a.games)
    ));

    const out = [];
    let bucket = [items[0]];
    for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1];
        const cur = items[i];
        if (Math.abs(wrightZScore(prev.wins, prev.games, cur.wins, cur.games)) < Z_EQUIV) {
            bucket.push(cur);
        } else {
            sortBucket(bucket);
            out.push(...bucket);
            bucket = [cur];
        }
    }
    sortBucket(bucket);
    out.push(...bucket);
    return out;
}

export function buildTierChampions(cAugStats, gamesCount, champWr = 50) {
    const minSample = Math.max(2, Math.floor(gamesCount * 0.02));
    const tiers = { kSilver: [], kGold: [], kPrismatic: [] };

    Object.entries(cAugStats).forEach(([id, d]) => {
        if (d.games < minSample) return;
        const rarity = getAugRarity(Number(id));
        if (!tiers[rarity]) return;

        const wr = smoothedWinRate(d.wins, d.games);
        tiers[rarity].push({
            id: Number(id),
            wr: wr,
            rawWr: d.wins / d.games * 100,
            games: d.games,
            wins: d.wins,
            priority: wilsonLowerBound(d.wins, d.games)
        });
    });

    Object.keys(tiers).forEach(k => {
        tiers[k] = rankByWRAndSamples(tiers[k], champWr, maturityFloorFor(gamesCount)).slice(0, 10);
    });

    return tiers;
}

export function buildSeenPairs(games, topN = 5, minGames = 2) {
    const map = {};
    games.forEach(g => {
        const augs = [...new Set(g.augments.map(Number).filter(Boolean))];
        for (let i = 0; i < augs.length; i++) {
            for (let j = i + 1; j < augs.length; j++) {
                const a = augs[i], b = augs[j];
                const key = a < b ? `${a}|${b}` : `${b}|${a}`;
                if (!map[key]) map[key] = { ids: a < b ? [a, b] : [b, a], games: 0, wins: 0 };
                map[key].games++;
                if (g.win) map[key].wins++;
            }
        }
    });
    return Object.values(map)
        .filter(d => d.games >= minGames)
        .map(d => {
            const wr = smoothedWinRate(d.wins, d.games);
            return {
                ...d,
                winRate: wr,
                priority: wr + (Math.log(Math.max(1, d.games)) * 5)
            };
        })
        .filter(d => d.games >= Math.max(2, games.length * 0.01))
        .sort((a, b) => b.priority - a.priority || b.games - a.games)
        .slice(0, topN);
}

// Chip renderer
export function augChipFull(id, extraClass = '') {
    const info = AUGMENT_DATA[id] || { name: `Augment ${id}`, icon: '', rarity: 'kUnknown' };
    const rarity = info.rarity || 'kUnknown';
    const rarityClass = { kSilver: 'sc-aug-silver', kGold: 'sc-aug-gold', kPrismatic: 'sc-aug-prismatic' }[rarity] || '';
    return `
        <div class="sc-combo-chip sc-combo-chip--aug ${rarityClass} ${extraClass}">
            ${info.icon ? `<img src="${info.icon}" class="aram-icon" title="${info.name}">` : ''}
            <span class="sc-combo-name sc-combo-name--aug">${info.name}</span>
        </div>
    `;
}

// Card renderers
export function renderSeenPairCards(pairs) {
    if (pairs.length === 0) {
        const p = document.createElement('p');
        p.className = 'sc-empty';
        p.textContent = 'Not enough data - need ≥2 games with the same pair.';
        return p;
    }
    const wrap = document.createElement('div');
    wrap.className = 'sc-combo-cards';
    pairs.forEach((pair, rank) => {
        const card = document.createElement('div');
        card.className = 'sc-combo-card';
        const wrClass = pair.winRate >= 60 ? 'aram-win-high' : pair.winRate <= 40 ? 'aram-win-low' : 'aram-winrate';
        const chips = pair.ids.map(id => augChipFull(id)).join('<span class="sc-combo-plus">+</span>');
        card.innerHTML = `
            <div class="sc-combo-rank">#${rank + 1}</div>
            <div class="sc-combo-chips sc-combo-chips--aug">${chips}</div>
            <div class="sc-combo-meta">
                <span class="${wrClass}">${pair.winRate.toFixed(1)}%</span>
                <span class="sc-combo-games">${pair.games}g</span>
            </div>
        `;
        wrap.appendChild(card);
    });
    return wrap;
}

export function renderTierChampions(tiers, gamesCount = 0, champWr = 50) {
    const wrap = document.createElement('div');
    wrap.className = 'sc-tier-champions-board';

    const order = ['kPrismatic', 'kGold', 'kSilver'];
    order.forEach(tierKey => {
        const tierData = tiers[tierKey];
        if (!tierData || tierData.length === 0) return;

        const col = document.createElement('div');
        col.className = `sc-tier-col sc-tier-col--${tierKey}`;

        const label = document.createElement('div');
        label.className = 'sc-tier-label';
        label.textContent = rarityLabel(tierKey);
        col.appendChild(label);

        const grid = document.createElement('div');
        grid.className = 'sc-tier-grid-wrap';

        tierData.forEach((aug) => {
            const info = AUGMENT_DATA[aug.id];
            const item = document.createElement('div');
            item.className = 'sc-tier-item-mini';
            item.innerHTML = `
                <img src="${info?.icon || ''}" class="sc-tier-icon-mini" title="${info?.name || 'Augment'}">
                <div class="sc-tier-item-details">
                    <div class="sc-tier-name-mini" title="${info?.name || 'Augment'}">${info?.name || 'Augment'}</div>
                    <div class="sc-tier-wr-mini" style="color: ${augWrColor(aug.wr, champWr)}">${aug.wr.toFixed(1)}% WR · ${gamesCount > 0 ? (aug.games / gamesCount * 100).toFixed(1) : 0}% PR</div>
                </div>
            `;
            grid.appendChild(item);
        });

        col.appendChild(grid);
        wrap.appendChild(col);
    });

    return wrap;
}

// Augment section builder (Specific Champions tab)
/**
 * Builds the full augment panel for a champion detail view.
 * Returns a ready-to-append .sc-aug-section element.
 */
export function buildAugSection(games, cAugStats, totalGames, champWr = 50) {
    const augSection = document.createElement('div');
    augSection.className = 'sc-aug-section';

    const sugTitle = document.createElement('h3');
    sugTitle.className = 'sc-section-title';
    sugTitle.innerHTML = `TOP AUGMENTS BY TIER <span class="sc-section-hint">Ranked by win rate, Confidence-adjusted</span>`;
    augSection.appendChild(sugTitle);

    const tiers = buildTierChampions(cAugStats, games.length, champWr);
    augSection.appendChild(renderTierChampions(tiers, games.length, champWr));

    const pairsTitle = document.createElement('h3');
    pairsTitle.className = 'sc-section-title sc-section-title--pairs';
    pairsTitle.textContent = 'Best Seen Aug Pairs';
    augSection.appendChild(pairsTitle);
    augSection.appendChild(renderSeenPairCards(buildSeenPairs(games, 5, 2)));

    const augTableTitle = document.createElement('h3');
    augTableTitle.className = 'sc-section-title sc-section-title--pairs';
    augTableTitle.textContent = 'Individual Augments';
    augSection.appendChild(augTableTitle);

    const augRows = Object.entries(cAugStats).map(([aId, d]) => {
        const info = AUGMENT_DATA[aId] || { name: `Augment ${aId}`, icon: '', rarity: '' };
        const rarity = info.rarity || '';
        return {
            id: aId, name: info.name, icon: info.icon, rarity, ...d,
            winRate: smoothedWinRate(d.wins, d.games)
        };
    }).sort((a, b) => b.games - a.games);

    if (augRows.length === 0) {
        const p = document.createElement('p');
        p.className = 'sc-empty';
        p.textContent = 'No augment data.';
        augSection.appendChild(p);
    } else {
        const columns = [
            { label: 'Augment', key: 'name', render: r => {
                const rc = { kSilver: 'sc-aug-silver', kGold: 'sc-aug-gold', kPrismatic: 'sc-aug-prismatic' }[r.rarity] || '';
                return `<div class="aram-icon-cell"><span class="sc-rarity-dot ${rc}"></span>${r.icon ? `<img src="${r.icon}" class="aram-icon sc-aug-border ${rc}">` : ''} ${r.name}</div>`;
            }},
            { label: 'Picked', key: 'games' },
            { label: 'Win %', key: 'winRate', render: r => `<span class="${r.winRate >= 60 ? 'aram-win-high' : r.winRate <= 40 ? 'aram-win-low' : ''}">${r.winRate.toFixed(1)}%</span>` }
        ];
        const augTable = createInteractiveTable(columns, augRows, 'games');
        attachTableSearch(augTableTitle, augRows, 'name', (filtered) => {
            augTable.querySelector('tbody').innerHTML = '';
            filtered.forEach(r => {
                const tr = document.createElement('tr');
                const spacer = document.createElement('td');
                spacer.className = 'aram-collapse-spacer';
                tr.appendChild(spacer);
                columns.forEach(col => {
                    const td = document.createElement('td');
                    if (col.render) td.innerHTML = col.render(r);
                    else td.textContent = r[col.key];
                    tr.appendChild(td);
                });
                augTable.querySelector('tbody').appendChild(tr);
            });
        });
        augSection.appendChild(augTable);
    }

    return augSection;
}
