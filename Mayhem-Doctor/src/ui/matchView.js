/**
 * Renders the full per-match scoreboard inside a the container,
 */

import { VALID_QUEUE_IDS } from '../config.js';
import { myPuuid, AUGMENT_DATA, ITEM_DATA, getChampionIcon, getSummonerSpellIcon } from '../lcu.js';

// Entry point 
export function openAramMatchView(game, targetContainer = null) {
    const detail = game.json;
    if (!detail || !VALID_QUEUE_IDS.includes(detail.queueId)) return;

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

    const durationMin = Math.floor(detail.gameDuration / 60);
    const durationSec = detail.gameDuration % 60;

    const myParticipant = detail.participants.find(p => p.puuid === myPuuid);
    if (!myParticipant) return;
    const myTeamId = myParticipant.teamId;

    const allies  = detail.participants.filter(p => p.teamId === myTeamId);
    const enemies = detail.participants.filter(p => p.teamId !== myTeamId);
    const blueKills = allies.reduce((sum, p) => sum + p.kills, 0);
    const redKills  = enemies.reduce((sum, p) => sum + p.kills, 0);

    const STAT_MODES = [
        { key: 'totalDamageDealtToChampions', label: 'Damage Dealt', color: '#e84057' },
        { key: 'totalDamageTaken',            label: 'Damage Taken', color: '#95a5a6' },
        { key: 'damageSelfMitigated',         label: 'Mitigated',    color: '#e67e22' },
        { key: 'totalHeal',                   label: 'Healing',      color: '#01ce8a' },
        { key: 'goldEarned',                  label: 'Gold',         color: '#f1c40f', format: v => (v / 1000).toFixed(1) + 'k' }
    ];
    let currentModeIdx = 0;

    function renderTables() {
        const mode = STAT_MODES[currentModeIdx];
        const allPlayers = [...allies, ...enemies];
        const maxVal = Math.max(...allPlayers.map(p => p[mode.key] || 0)) || 1;
        const teamsContainer = view.querySelector('#fm-teams-container');
        if (teamsContainer) {
            teamsContainer.innerHTML = `
                ${renderTeam(myTeamId === 100 ? 'Blue Team' : 'Red Team', allies,  maxVal, blueKills, true,  mode)}
                ${renderTeam(myTeamId === 200 ? 'Blue Team' : 'Red Team', enemies, maxVal, redKills,  false, mode)}
            `;
            bindHeaderEvents();
        }
    }

    view.innerHTML = `
        <div class="fm-header">
            <div class="fm-header-left">
                <button class="sc-back-btn aram-btn-start" style="margin:0;">← Back</button>
                <h2 class="${myParticipant.win ? 'fm-victory' : 'fm-defeat'}">${myParticipant.win ? 'VICTORY' : 'DEFEAT'}</h2>
            </div>
            <div class="fm-meta">Patch ${detail.gameVersion.split('.').slice(0, 2).join('.')} &bull; ${durationMin}m ${durationSec.toString().padStart(2, '0')}s</div>
        </div>
        <div id="fm-teams-container"></div>
    `;
    container.appendChild(view);
    renderTables();

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

    // Copy-ID badges
    view.addEventListener('click', (e) => {
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
}

function renderTeam(title, team, maxVal, totalKills, isBlue, mode) {
    return `
        <div>
            <div class="fm-team-title ${isBlue ? 'fm-blue' : 'fm-red'}">
                <span>${title}</span>
                <span>${totalKills} Kills</span>
            </div>
            <table class="fm-table">
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
                        </th>
                        <th>Items</th>
                    </tr>
                </thead>
                <tbody>
                    ${team.map(p => renderParticipantRow(p, maxVal, mode)).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderParticipantRow(p, maxVal, mode) {
    const rawVal  = p[mode.key] || 0;
    const pct     = maxVal > 0 ? (rawVal / maxVal) * 100 : 0;
    const textVal = mode.format ? mode.format(rawVal) : rawVal.toLocaleString();
    const riotId  = p.riotIdGameName || p.summonerName;
    const tagline = p.riotIdTagline || '';
    const fullId  = tagline ? `${riotId}#${tagline}` : riotId;

    const augs = [p.playerAugment1, p.playerAugment2, p.playerAugment3, p.playerAugment4, p.playerAugment5, p.playerAugment6].filter(id => id > 0);
    const augsHtml = augs.map(id => {
        const info = AUGMENT_DATA[id];
        return info && info.icon ? `<img src="${info.icon}" title="${info.name}">` : '';
    }).join('');

    const items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].filter(id => id > 0);
    const itemsHtml = items.map(id => {
        const info = ITEM_DATA[id];
        return info && info.icon ? `<img src="${info.icon}" title="${info.name}">` : '';
    }).join('');

    const copySvg = `<svg class="copy-icon" viewBox="0 0 24 24"><path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/></svg>`;

    return `
        <tr class="${p.puuid === myPuuid ? 'fm-me' : ''}">
            <td>
                <div class="fm-champ">
                    <img src="${getChampionIcon(p.championId)}" title="${p.championName}">
                    <div class="fm-spells">
                        <img src="${getSummonerSpellIcon(p.spell1Id)}">
                        <img src="${getSummonerSpellIcon(p.spell2Id)}">
                    </div>
                    <div class="fm-name-wrapper">
                        <span class="fm-name" title="${fullId}">${riotId}</span>
                        ${tagline ? `<div class="copy-badge" data-fullid="${fullId}">${copySvg} Copy ID</div>` : ''}
                    </div>
                </div>
            </td>
            <td><div class="fm-augs">${augsHtml}</div></td>
            <td>${p.kills} / ${p.deaths} / ${p.assists}</td>
            <td>
                <div class="fm-bar-wrap">
                    <div class="fm-bar-bg">
                        <div class="fm-bar-fill" style="width:${pct}%; background-color:${mode.color};"></div>
                    </div>
                    <span>${textVal}</span>
                </div>
            </td>
            <td><div class="fm-items">${itemsHtml}</div></td>
        </tr>
    `;
}
