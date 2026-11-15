/**
 * Renders the full per-match scoreboard inside a the container
 */

import { VALID_QUEUE_IDS, BLACKLIST_AUGMENT_IDS } from '../config.js';
import { Mode } from '../mode.js';
import { myPuuid, AUGMENT_DATA, ITEM_DATA, CHAMPION_DATA, getChampionIcon, getSummonerSpellIcon } from '../lcu.js';
import { readGlobalStats } from '../globalCache.js';
import { getAugRarity } from './augments.js';
import { smoothedWinRate } from '../analysis.js';

// Damage-type segment colors shared by Dealt and Taken stacked bars
const SEG_COLORS = ['#e84057', '#4f8cff', '#cfd8dc']; // physical, magic, true

const STAT_MODES = [
    {
        key: 'dealt', label: 'Damage Dealt', stacked: true, color: '#e84057',
        get: p => p.totalDamageDealtToChampions || 0,
        seg: p => [p.physicalDamageDealtToChampions || 0, p.magicDamageDealtToChampions || 0, p.trueDamageDealtToChampions || 0],
    },
    {
        key: 'taken', label: 'Damage Taken', stacked: true, color: '#95a5a6',
        get: p => p.totalDamageTaken || 0,
        seg: p => [p.physicalDamageTaken || 0, p.magicDamageTaken || 0, p.trueDamageTaken || 0],
    },
    { key: 'mit',  label: 'Mitigated',        color: '#e67e22', get: p => p.damageSelfMitigated || 0 },
    { key: 'heal', label: 'Healing',          color: '#01ce8a', get: p => p.totalHeal || 0 },
    { key: 'ally', label: 'Ally Heal+Shield', color: '#2de0a5', get: p => (p.totalHealsOnTeammates || 0) + (p.totalDamageShieldedOnTeammates || 0) },
    { key: 'gold', label: 'Gold',             color: '#f1c40f', get: p => p.goldEarned || 0 },
    { key: 'cs',   label: 'CS',               color: '#8fbf6f', get: p => (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0) },
];

// Entry point
// meta: { mode?: 'official'|'classic', result?: 'Win'|'Loss'|'Remake' }
export function openAramMatchView(game, targetContainer = null, meta = {}) {
    const detail = game.json;
    if (!detail || !VALID_QUEUE_IDS.includes(detail.queueId)) return;

    const mode = meta.mode || Mode.OFFICIAL;

    let container = targetContainer ||
                    document.querySelector('#mi-results') ||
                    document.querySelector('.aram-modal-content');
    if (!container) return;

    // Snapshot children to hide while the detail view is shown,
    // skipping the X button and any already-open match view.
    const childrenToHide = Array.from(container.children).filter(c =>
        !c.classList.contains('aram-modal-close') &&
        !c.classList.contains('aram-full-match-view')
    );
    childrenToHide.forEach(c => { c.style.display = 'none'; });

    const view = document.createElement('div');
    view.className = 'aram-full-match-view';
    view.id = 'aram-match-view';

    const durationMin = Math.max(1, Math.floor(detail.gameDuration / 60));
    const durationSec = detail.gameDuration % 60;

    const myParticipant = detail.participants.find(p => p.puuid === myPuuid);
    if (!myParticipant) return;
    const myTeamId = myParticipant.teamId;

    const allies  = detail.participants.filter(p => p.teamId === myTeamId);
    const enemies = detail.participants.filter(p => p.teamId !== myTeamId);
    const blueKills = allies.reduce((sum, p) => sum + p.kills, 0);
    const redKills  = enemies.reduce((sum, p) => sum + p.kills, 0);

    // Meta index from crawl data (per champion in this game):
    // global WR + per-augment-combo WR. Null when no crawl data -> column hidden.
    const metaIndex = buildMetaIndex(
        [...allies, ...enemies].map(p => p.championId), mode
    );
    const hasMeta = !!metaIndex;

    const isRemake = meta.result === 'Remake';
    const resultText  = isRemake ? 'REMAKE' : (myParticipant.win ? 'VICTORY' : 'DEFEAT');
    const resultClass = isRemake ? 'fm-remake' : (myParticipant.win ? 'fm-victory' : 'fm-defeat');

    let currentModeIdx = 0;
    let perMin = false;

    function renderTables() {
        const mode = STAT_MODES[currentModeIdx];
        const allPlayers = [...allies, ...enemies];
        const maxVal = Math.max(...allPlayers.map(p => mode.get(p) || 0)) || 1;
        const teamsContainer = view.querySelector('#fm-teams-container');
        if (teamsContainer) {
            teamsContainer.innerHTML = `
                ${renderTeam(myTeamId === 100 ? 'Blue Team' : 'Red Team', allies,  maxVal, blueKills, true,  mode, metaIndex, hasMeta, perMin, durationMin)}
                ${renderTeam(myTeamId === 200 ? 'Blue Team' : 'Red Team', enemies, maxVal, redKills,  false, mode, metaIndex, hasMeta, perMin, durationMin)}
            `;
            bindHeaderEvents();
        }
    }

    view.innerHTML = `
        <div class="fm-header">
            <div class="fm-header-left">
                <button class="sc-back-btn aram-btn-start" style="margin:0;">← Back</button>
                <h2 class="${resultClass}">${resultText}</h2>
            </div>
            <div class="fm-header-right">
                <span class="fm-meta" title="Click any stat value to toggle per-minute values">Patch ${detail.gameVersion.split('.').slice(0, 2).join('.')} &bull; ${durationMin}m ${durationSec.toString().padStart(2, '0')}s</span>
            </div>
        </div>
        <div id="fm-teams-container"></div>
    `;
    container.appendChild(view);
    renderTables();

    // Delegated clicks: stat value digits toggle per-minute; copy badges copy Riot ID
    view.addEventListener('click', (e) => {
        if (e.target.closest('.fm-bar-val')) {
            perMin = !perMin;
            renderTables();
            return;
        }
        const btn = e.target.closest('.copy-badge');
        if (!btn) return;
        e.stopPropagation();
        const text = btn.dataset.fullid;
        navigator.clipboard.writeText(text).then(() => {
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Copied!';
            btn.style.color = '#01ce8a';
            btn.style.borderColor = '#01ce8a';
            setTimeout(() => { btn.innerHTML = originalText; btn.style.color = ''; btn.style.borderColor = ''; }, 1500);
        });
    });

    function bindHeaderEvents() {
        view.querySelectorAll('.stat-arrow-prev').forEach(btn => {
            btn.onclick = () => { currentModeIdx = (currentModeIdx - 1 + STAT_MODES.length) % STAT_MODES.length; renderTables(); };
        });
        view.querySelectorAll('.stat-arrow-next').forEach(btn => {
            btn.onclick = () => { currentModeIdx = (currentModeIdx + 1) % STAT_MODES.length; renderTables(); };
        });
    }

    view.querySelector('.sc-back-btn').addEventListener('click', () => {
        view.remove();
        childrenToHide.forEach(c => { c.style.display = ''; });
    });
}

/**
 * Builds a lightweight meta index for the champions present in this game.
 * Only iterates those champions' game records from the crawl payload.
 * Per champion: global WR + an augment-PAIR map
 * Returns null when no global crawl data is available.
 */
function buildMetaIndex(champIds, mode) {
    try {
        const gd = readGlobalStats(mode);
        if (!gd) return null;

        const index = {};
        for (const champId of new Set(champIds)) {
            const cKey = String(champId);
            const cS = gd.stats.champions[cKey];
            const records = gd.champGames[cKey] || [];

            const pairMap = {};
            for (const rec of records) {
                const augs = [...new Set((rec.augments || []).map(Number))]
                    .filter(a => a && !BLACKLIST_AUGMENT_IDS.has(a))
                    .sort((a, b) => a - b);
                for (let i = 0; i < augs.length; i++) {
                    for (let j = i + 1; j < augs.length; j++) {
                        const key = augs[i] + '|' + augs[j];
                        if (!pairMap[key]) pairMap[key] = { a: augs[i], b: augs[j], games: 0, wins: 0 };
                        pairMap[key].games++;
                        if (rec.win) pairMap[key].wins++;
                    }
                }
            }

            index[cKey] = {
                games: cS ? cS.games : 0,
                champGames: records.length,
                wr: cS && cS.games > 0 ? smoothedWinRate(cS.wins, cS.games) : null,
                pairMap,
            };
        }
        return index;
    } catch (e) {
        return null;
    }
}

function fmtGames(n) {
    if (n == null) return '';
    return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
}

function fmtStat(v, perMin, durationMin) {
    if (!perMin) {
        return v >= 10000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v).toLocaleString();
    }
    const val = v / Math.max(1, durationMin);
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k/m';
    return (val >= 10 ? Math.round(val) : val.toFixed(1)) + '/m';
}

function renderTeam(title, team, maxVal, totalKills, isBlue, mode, metaIndex, hasMeta, perMin, durationMin) {
    const rows = [...team].sort((a, b) => (mode.get(b) || 0) - (mode.get(a) || 0));
    const teamTotal = team.reduce((sum, p) => sum + (mode.get(p) || 0), 0);
    const champName = id => CHAMPION_DATA[id] || '';
    return `
        <div>
            <div class="fm-team-title ${isBlue ? 'fm-blue' : 'fm-red'}">
                <span>${title}</span>
                <span>${totalKills} Kills</span>
            </div>
            <table class="fm-table ${hasMeta ? 'fm-has-meta' : ''}">
                <thead>
                    <tr>
                        <th>Champion</th>
                        <th>Augments</th>
                        <th>KDA</th>
                        <th>
                            <div class="stat-header">
                                <span class="stat-arrow stat-arrow-prev">&lt;</span>
                                <span class="stat-label">${mode.label}</span>
                                <span class="stat-arrow stat-arrow-next">&gt;</span>
                            </div>
                            ${mode.stacked ? `
                            <div class="fm-legend">
                                <span class="fm-legend-sq" style="background:${SEG_COLORS[0]}"></span>Phys
                                <span class="fm-legend-sq" style="background:${SEG_COLORS[1]}"></span>Magic
                                <span class="fm-legend-sq" style="background:${SEG_COLORS[2]}"></span>True
                            </div>` : ''}
                        </th>
                        ${hasMeta ? `<th title="From global crawl data: champion win rate and this exact augment combo's win rate">Meta</th>` : ''}
                        <th>Items</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(p => renderParticipantRow(p, maxVal, mode, teamTotal, totalKills, champName(p.championId), metaIndex, hasMeta, perMin, durationMin)).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderParticipantRow(p, maxVal, mode, teamTotal, teamKills, champTitle, metaIndex, hasMeta, perMin, durationMin) {
    const rawVal  = mode.get(p) || 0;
    const pct     = maxVal > 0 ? (rawVal / maxVal) * 100 : 0;
    const share   = teamTotal > 0 ? Math.round((rawVal / teamTotal) * 100) : 0;
    const textVal = fmtStat(rawVal, perMin, durationMin);
    const riotId  = p.riotIdGameName || p.summonerName;
    const tagline = p.riotIdTagline || '';
    const fullId  = tagline ? `${riotId}#${tagline}` : riotId;

    const augs = [p.playerAugment1, p.playerAugment2, p.playerAugment3, p.playerAugment4, p.playerAugment5, p.playerAugment6]
        .filter(id => id > 0 && !BLACKLIST_AUGMENT_IDS.has(id));
    const augsHtml = augs.map(id => {
        const info = AUGMENT_DATA[id];
        if (!info || !info.icon) return '';
        const rc = { kSilver: 'sc-aug-silver', kGold: 'sc-aug-gold', kPrismatic: 'sc-aug-prismatic' }[getAugRarity(id)] || '';
        return `<img src="${info.icon}" class="sc-aug-border ${rc}" title="${info.name}">`;
    }).join('');

    const items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].filter(id => id > 0);
    const itemsHtml = items.map(id => {
        const info = ITEM_DATA[id];
        return info && info.icon ? `<img src="${info.icon}" title="${info.name}">` : '';
    }).join('');

    // Stat bar: stacked damage-type segments for Dealt/Taken, plain fill otherwise
    let barHtml;
    if (mode.stacked) {
        const segs = mode.seg(p);
        const segTotal = segs.reduce((a, b) => a + b, 0) || 1;
        barHtml = `
            <div class="fm-bar-wrap">
                <div class="fm-bar-bg">
                    <div class="fm-bar-stack" style="width:${pct}%;">
                        ${segs.map((v, i) => `<span class="fm-bar-seg" style="width:${(v / segTotal) * 100}%; background:${SEG_COLORS[i]};" title="${['Physical', 'Magic', 'True'][i]}: ${Math.round(v).toLocaleString()}"></span>`).join('')}
                    </div>
                </div>
                <span class="fm-bar-val" title="Click to toggle per-minute values">${textVal}</span>
                <span class="fm-bar-share" title="Share of team total">${share}%</span>
            </div>
        `;
    } else {
        barHtml = `
            <div class="fm-bar-wrap">
                <div class="fm-bar-bg">
                    <div class="fm-bar-fill" style="width:${pct}%; background-color:${mode.color};"></div>
                </div>
                <span class="fm-bar-val" title="Click to toggle per-minute values">${textVal}</span>
                <span class="fm-bar-share" title="Share of team total">${share}%</span>
            </div>
        `;
    }

    // Kill participation
    const kp = teamKills > 0 ? Math.round(((p.kills + p.assists) / teamKills) * 100) : null;

    // Objective / first-event badges
    const badges = [];
    if (p.firstBloodKill)
        badges.push(`<span class="fm-badge fm-badge--fb" title="First Blood">FB</span>`);
    if (p.firstTowerKill)
        badges.push(`<span class="fm-badge fm-badge--ft" title="First Tower">FT</span>`);
    const objParts = [];
    if ((p.turretTakedowns || 0) > 0) objParts.push(`T×${p.turretTakedowns}`);
    if ((p.inhibitorTakedowns || 0) > 0) objParts.push(`I×${p.inhibitorTakedowns}`);
    if (objParts.length) {
        const objTitle = [
            (p.turretTakedowns || 0) > 0 ? `${p.turretTakedowns} turret takedown${p.turretTakedowns !== 1 ? 's' : ''}` : null,
            (p.inhibitorTakedowns || 0) > 0 ? `${p.inhibitorTakedowns} inhibitor takedown${p.inhibitorTakedowns !== 1 ? 's' : ''}` : null,
        ].filter(Boolean).join(' · ');
        badges.push(`<span class="fm-badge fm-badge--obj" title="${objTitle}">${objParts.join(' ')}</span>`);
    }
    const badgesHtml = badges.length ? `<div class="fm-badges">${badges.join('')}</div>` : '';

    // Meta column: champion WR + best-performing augment pair from this player's set (same ranking units as buildSeenPairs: Laplace WR + log(games) popularity)
    let metaHtml = '';
    if (hasMeta) {
        const m = metaIndex[String(p.championId)];
        const champWr = m && m.wr != null ? m.wr.toFixed(1) + '%' : '—';

        let pair = null;
        if (m && augs.length >= 2) {
            const minGames = Math.max(2, Math.floor((m.champGames || 0) * 0.01));
            const uniq = [...new Set(augs)].sort((a, b) => a - b);
            for (let i = 0; i < uniq.length; i++) {
                for (let j = i + 1; j < uniq.length; j++) {
                    const cand = m.pairMap[uniq[i] + '|' + uniq[j]];
                    if (!cand || cand.games < minGames) continue;
                    const wr = smoothedWinRate(cand.wins, cand.games);
                    const priority = wr + Math.log(Math.max(1, cand.games)) * 5;
                    if (!pair || priority > pair.priority) pair = { ...cand, wr, priority };
                }
            }
        }

        const pairNames = pair
            ? `${AUGMENT_DATA[pair.a]?.name || 'Augment ' + pair.a} + ${AUGMENT_DATA[pair.b]?.name || 'Augment ' + pair.b}`
            : 'No qualifying augment pair data (min 1% of this champion\'s crawled games)';
        const pairIcons = pair
            ? [pair.a, pair.b].map(id => {
                  const info = AUGMENT_DATA[id];
                  if (!info || !info.icon) return '';
                  const rc = { kSilver: 'sc-aug-silver', kGold: 'sc-aug-gold', kPrismatic: 'sc-aug-prismatic' }[getAugRarity(id)] || '';
                  return `<img src="${info.icon}" class="fm-meta-pair-icon sc-aug-border ${rc}" title="${info.name}">`;
              }).join('')
            : '';

        metaHtml = `
            <td class="fm-meta-cell">
                <div class="fm-meta-line" title="Global crawl WR for ${champTitle || 'this champion'}">${champWr} <span class="fm-meta-sub">${m ? fmtGames(m.games) + 'g' : ''}</span></div>
                <div class="fm-meta-line" title="${pairNames}">${pairIcons}${pair ? pair.wr.toFixed(1) + '%' : '—'} <span class="fm-meta-sub">${pair ? '· ' + fmtGames(pair.games) + 'g' : 'augs'}</span></div>
            </td>
        `;
    }

    const copySvg = `<svg class="copy-icon" viewBox="0 0 24 24"><path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/></svg>`;

    return `
        <tr class="${p.puuid === myPuuid ? 'fm-me' : ''}">
            <td>
                <div class="fm-champ">
                    <img src="${getChampionIcon(p.championId)}" title="${champTitle || p.championName || ''}">
                    <div class="fm-spells">
                        <img src="${getSummonerSpellIcon(p.spell1Id)}">
                        <img src="${getSummonerSpellIcon(p.spell2Id)}">
                    </div>
                    <div class="fm-name-wrapper">
                        <span class="fm-name" title="${fullId}">${riotId}</span>
                        ${badgesHtml}
                        ${tagline ? `<div class="copy-badge" data-fullid="${fullId}">${copySvg} Copy ID</div>` : ''}
                    </div>
                </div>
            </td>
            <td><div class="fm-augs">${augsHtml}</div></td>
            <td>
                <div>${p.kills} / ${p.deaths} / ${p.assists}</div>
                ${kp != null ? `<div class="fm-kp" title="Kill participation">KP ${kp}%</div>` : ''}
            </td>
            <td>${barHtml}</td>
            ${metaHtml}
            <td><div class="fm-items">${itemsHtml}</div></td>
        </tr>
    `;
}
