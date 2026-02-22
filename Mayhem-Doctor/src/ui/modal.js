/**
 * Modal overlay factory and the commandBar action activation modal (Alt+X) or whatever hotkey.
 */

import { startSelfAnalysis, startInvestigatorAnalysis } from '../analysis.js';
import { renderStatsInto } from './tabs.js';

//  Modal factory 
export function createModal() {
    const overlay = document.createElement('div'); overlay.className = 'aram-modal-overlay';
    const content = document.createElement('div'); content.className = 'aram-modal-content';
    overlay.appendChild(content); document.body.appendChild(overlay);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    return content;
}

export async function displayStats(modalContent, finalStats, fullHistory) {
    await renderStatsInto(modalContent, finalStats, fullHistory, { showClose: true });
}

//  Command bar modal 
export function openCommandBarModal() {
    const modalContent = createModal();

    function setStatus(type, msg) {
        const bar = modalContent.querySelector('#cb-status-bar');
        if (!bar) return;
        bar.className    = `mi-status-bar mi-status-${type}`;
        bar.textContent  = msg;
        bar.style.display = 'block';
    }

    function runAndRender(startFn, args, title) {
        modalContent.innerHTML = `
            <div class="aram-modal-close">&times;</div>
            <h2 id="cb-title">${title}</h2>
            <div id="cb-status-bar" class="mi-status-bar mi-status-info"></div>
        `;
        modalContent.querySelector('.aram-modal-close').onclick = () => modalContent.parentElement.remove();

        startFn(async (update) => {
            if (update.status) setStatus('info', update.status);
            if (update.error)  setStatus('error', `Error: ${update.error}`);
            if (update.finalStats) {
                await renderStatsInto(modalContent, update.finalStats, update.fullHistory, {
                    showClose: true,
                    title
                });
            }
        }, ...args);
    }

    // Picker screen
    modalContent.innerHTML = `
        <div class="aram-modal-close">&times;</div>
        <h2>Mayhem Doctor</h2>
        <div class="mi-controls">
            <div class="mi-input-group">
                <label class="mi-label" for="cb-game-count">Games to Analyse</label>
                <div class="mi-slider-row">
                    <input id="cb-slider" class="mi-slider" type="range" min="10" max="400" value="50">
                    <input id="cb-game-count" class="aram-number-input" type="number" value="50" min="10" max="400">
                </div>
            </div>
            <div class="cb-picker-buttons">
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
    `;
    modalContent.querySelector('.aram-modal-close').onclick = () => modalContent.parentElement.remove();

    const slider   = modalContent.querySelector('#cb-slider');
    const numInput = modalContent.querySelector('#cb-game-count');
    slider.oninput   = () => { numInput.value = slider.value; };
    numInput.oninput = () => { slider.value   = numInput.value; };

    modalContent.querySelector('#cb-self-btn').onclick = () => {
        const count = parseInt(numInput.value) || 50;
        runAndRender(startSelfAnalysis, [count], 'My Mayhem Stats');
    };

    modalContent.querySelector('#cb-other-btn').onclick = () => {
        modalContent.querySelector('#cb-riot-id-row').style.display = '';
        modalContent.querySelector('#cb-other-btn').style.display   = 'none';
    };

    modalContent.querySelector('#cb-investigate-btn').onclick = () => {
        const riotId = modalContent.querySelector('#cb-riot-id').value.trim();
        const count  = parseInt(numInput.value) || 50;
        if (!riotId || !riotId.includes('#')) {
            Toast.error('Please enter a valid Riot ID in the format GameName#TAG.');
            return;
        }
        runAndRender(startInvestigatorAnalysis, [riotId, count], `${riotId} — Mayhem Stats`);
    };
}