/**
 * Augment analysis: pairwise lift model, suggested build, seen pairs.
 * DOM renderers for element + rarity helpers.
 */

import { AUGMENT_DATA } from '../lcu.js';
import { smoothedWinRate } from '../analysis.js';
import { createInteractiveTable } from './table.js';

//  Rarity helpers 
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

function confidenceLabel(games) {
    if (games >= 25) return { label: 'high', cls: 'sc-conf-high' };
    if (games >= 10) return { label: 'medium', cls: 'sc-conf-mid' };
    return { label: 'low', cls: 'sc-conf-low' };
}

//  Pairwise lift model
/**
 * For each pair (A,B) seen together, compute:
 *   lift(A,B) = smoothedWR(A∩B) − mean(smoothedWR(A), smoothedWR(B))
 * Positive lift = they synergize beyond their individual win rates.
 * All win rates are Laplace-smoothed before comparison so small-n pairs
 * don't dominate.
 */
export function buildPairLift(games, singleStats) {
    const pairMap = {};
    games.forEach(g => {
        const augs = [...new Set(g.augments.map(Number).filter(Boolean))];
        for (let i = 0; i < augs.length; i++) {
            for (let j = i + 1; j < augs.length; j++) {
                const a = augs[i], b = augs[j];
                const key = a < b ? `${a}|${b}` : `${b}|${a}`;
                if (!pairMap[key]) pairMap[key] = { ids: a < b ? [a, b] : [b, a], games: 0, wins: 0 };
                pairMap[key].games++;
                if (g.win) pairMap[key].wins++;
            }
        }
    });
    const result = {};
    Object.entries(pairMap).forEach(([key, d]) => {
        const [a, b] = d.ids;
        const sA = singleStats[a], sB = singleStats[b];
        if (!sA || !sB) return;
        const wrPair = smoothedWinRate(d.wins, d.games);
        const wrA    = smoothedWinRate(sA.wins, sA.games);
        const wrB    = smoothedWinRate(sB.wins, sB.games);
        const lift   = wrPair - (wrA + wrB) / 2;
        // Shrinkage: trust scales continuously with co-occurrence count.
        // coGames / (coGames + 5) never hard-plateaus unlike min(1, n/5).
        const shrinkage = d.games / (d.games + 5);
        result[key] = { ids: d.ids, liftScore: lift * shrinkage, coGames: d.games, wrPair };
    });
    return result;
}

export function buildSuggestedAugBuild(games, singleStats, pairLift, totalChampGames) {
    if (games.length < 3) return null;
    const seen = Object.entries(singleStats)
        .filter(([, d]) => d.games >= 2)
        .map(([id, d]) => ({
            id:     Number(id),
            wr:     smoothedWinRate(d.wins, d.games),
            games:  d.games,
            rarity: getAugRarity(Number(id))
        }))
        .filter(a => a.rarity !== 'kUnknown');
    if (seen.length < 2) return null;

    const selected  = [];
    const remaining = [...seen];
    for (let slot = 0; slot < 4 && remaining.length > 0; slot++) {
        let bestScore = -Infinity, bestIdx = 0;
        remaining.forEach((cand, idx) => {
            let score = cand.wr;
            selected.forEach(sel => {
                const a = Math.min(cand.id, sel.id);
                const b = Math.max(cand.id, sel.id);
                const liftEntry = pairLift[`${a}|${b}`];
                if (liftEntry) score += liftEntry.liftScore;
            });
            if (score > bestScore) { bestScore = score; bestIdx = idx; }
        });
        selected.push(remaining.splice(bestIdx, 1)[0]);
    }

    // If every pick is silver and a higher-rarity aug exists, swap out
    // the weakest silver for it. Only fires when silver genuinely dominates
    // by smoothed WR, which is less likely to corrupt good recommendations
    // than using raw WR.
    const allSilver = selected.every(a => a.rarity === 'kSilver');
    if (allSilver) {
        const higherRarity = seen
            .filter(a => a.rarity !== 'kSilver' && !selected.find(s => s.id === a.id))
            .sort((a, b) => b.wr - a.wr)[0];
        if (higherRarity) {
            const weakestIdx = selected.reduce((wIdx, a, i, arr) => a.wr < arr[wIdx].wr ? i : wIdx, 0);
            selected[weakestIdx] = higherRarity;
        }
    }

    selected.sort((a, b) => rarityOrder(b.rarity) - rarityOrder(a.rarity));
    const conf = confidenceLabel(games.length);
    return { picks: selected, confidence: conf, sampleGames: games.length };
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
        .map(d => ({ ...d, winRate: smoothedWinRate(d.wins, d.games) }))
        .sort((a, b) => b.winRate - a.winRate || b.games - a.games)
        .slice(0, topN);
}

//  Chip renderer 
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

//  Card renderers 
export function renderSeenPairCards(pairs) {
    if (pairs.length === 0) {
        const p = document.createElement('p');
        p.className = 'sc-empty';
        p.textContent = 'Not enough data — need ≥2 games with the same pair.';
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

export function renderSuggestedBuild(build) {
    if (!build) {
        const p = document.createElement('p');
        p.className = 'sc-empty';
        p.textContent = 'Need ≥3 games with augment data to generate a suggestion.';
        return p;
    }
    const wrap = document.createElement('div');
    wrap.className = 'sc-suggested-build';
    const chips = build.picks.map(p => augChipFull(p.id, 'sc-suggested-chip')).join('');
    wrap.innerHTML = `
        <div class="sc-suggested-chips">${chips}</div>
        <div class="sc-suggested-footer">
            <span class="sc-suggested-label">Pairwise lift model</span>
            <span class="${build.confidence.cls} sc-suggested-conf">
                ${build.confidence.label} confidence &middot; ${build.sampleGames} games
            </span>
        </div>
    `;
    return wrap;
}

//  Augment section builder (Specific Champions tab) 
/**
 * Builds the full augment panel for a champion detail view.
 * Returns a ready-to-append .sc-aug-section element.
 */
export function buildAugSection(games, cAugStats, totalGames) {
    const augSection = document.createElement('div');
    augSection.className = 'sc-aug-section';

    const sugTitle = document.createElement('h3');
    sugTitle.className = 'sc-section-title';
    sugTitle.innerHTML = 'Suggested Aug Build <span class="sc-model-badge">pairwise model</span>';
    augSection.appendChild(sugTitle);

    const pairLift  = buildPairLift(games, cAugStats);
    const suggested = buildSuggestedAugBuild(games, cAugStats, pairLift, totalGames);
    augSection.appendChild(renderSuggestedBuild(suggested));

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
        const p = document.createElement('p'); p.className = 'sc-empty'; p.textContent = 'No augment data.';
        augSection.appendChild(p);
    } else {
        augSection.appendChild(createInteractiveTable([
            { label: 'Augment', key: 'name', render: r => {
                const rc = { kSilver: 'sc-aug-silver', kGold: 'sc-aug-gold', kPrismatic: 'sc-aug-prismatic' }[r.rarity] || '';
                return `<div class="aram-icon-cell"><span class="sc-rarity-dot ${rc}"></span>${r.icon ? `<img src="${r.icon}" class="aram-icon">` : ''} ${r.name}</div>`;
            }},
            { label: 'Picked', key: 'games' },
            { label: 'Win %',  key: 'winRate', render: r => `<span class="${r.winRate >= 60 ? 'aram-win-high' : r.winRate <= 40 ? 'aram-win-low' : ''}">${r.winRate.toFixed(1)}%</span>` }
        ], augRows, 'games'));
    }

    return augSection;
}
