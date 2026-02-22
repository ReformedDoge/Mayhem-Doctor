/**
 * Injects the "Mayhem Investigator" sub-tab on the profile page
 * and run button on the match history page.
 */

import { startSelfAnalysis, startInvestigatorAnalysis } from '../analysis.js';
import { createModal, displayStats } from './modal.js';
import { renderStatsInto } from './tabs.js';

export const INVESTIGATOR_TAB_ID   = 'mi-profile-tab';
export const INVESTIGATOR_PANEL_ID = 'mi-profile-panel';

//  Investigator dashboard UI 
export function buildInvestigatorDashboard() {
    const root = document.createElement('div');
    root.className = 'mi-dashboard';

    root.innerHTML = `
        <div class="mi-controls">
            <div class="mi-input-group">
                <label class="mi-label" for="mi-riot-id">Riot ID</label>
                <input id="mi-riot-id" class="mi-text-input" type="text" placeholder="GameName#TAG" spellcheck="false" autocomplete="off">
            </div>
            <div class="mi-input-group">
                <label class="mi-label" for="mi-game-count">Games to Analyse</label>
                <div class="mi-slider-row">
                    <input id="mi-slider" class="mi-slider" type="range" min="10" max="400" value="50">
                    <input id="mi-game-count" class="aram-number-input" type="number" value="50" min="10" max="400">
                </div>
            </div>
            <button id="mi-investigate-btn" class="aram-btn-start mi-btn">Investigate</button>
        </div>
        <div id="mi-status-bar" class="mi-status-bar mi-status-hidden"></div>
        <div id="mi-results" class="mi-results"></div>
    `;

    const slider    = root.querySelector('#mi-slider');
    const numInput  = root.querySelector('#mi-game-count');
    slider.oninput  = () => { numInput.value = slider.value; };
    numInput.oninput = () => { slider.value = numInput.value; };

    const btn        = root.querySelector('#mi-investigate-btn');
    const statusBar  = root.querySelector('#mi-status-bar');
    const resultsEl  = root.querySelector('#mi-results');

    function setStatus(type, msg) {
        statusBar.className = `mi-status-bar mi-status-${type}`;
        statusBar.textContent = msg;
        statusBar.classList.remove('mi-status-hidden');
    }

    btn.onclick = () => {
        const riotId = root.querySelector('#mi-riot-id').value.trim();
        const count  = parseInt(numInput.value) || 50;

        if (!riotId || !riotId.includes('#')) {
            Toast.error('Please enter a valid Riot ID in the format GameName#TAG.');
            return;
        }

        resultsEl.innerHTML = '';
        btn.disabled    = true;
        btn.textContent = 'Investigating…';
        setStatus('info', `Resolving "${riotId}"…`);

        startInvestigatorAnalysis(async (update) => {
            if (update.status) setStatus('info', update.status);
            if (update.error) {
                statusBar.classList.add('mi-status-hidden');
                Toast.error(`Error: ${update.error}`);
                btn.disabled    = false;
                btn.textContent = 'Investigate';
            }
            if (update.finalStats) {
                const total = update.finalStats.wins + update.finalStats.losses;
                statusBar.classList.add('mi-status-hidden');
                Toast.success(`Done! Analysed ${total} valid game${total !== 1 ? 's' : ''} for "${riotId}".`);
                await renderStatsInto(resultsEl, update.finalStats, update.fullHistory, {
                    title: `${riotId} — Mayhem Stats`
                });
                btn.disabled    = false;
                btn.textContent = 'Investigate';
            }
        }, riotId, count);
    };

    return root;
}

//  Panel positioning 
/**
 * Measures the sub-nav bar's bottom edge inside profileRoot and positions
 * the panel so it fills the content area exactly like the native section
 * controller does.
 */
export function positionPanel(panel, subNav, profileRoot) {
    const rootRect  = profileRoot.getBoundingClientRect();
    const navRect   = subNav.getBoundingClientRect();
    const topOffset = navRect.bottom - rootRect.top;
    panel.style.top    = `${topOffset}px`;
    panel.style.left   = '0';
    panel.style.right  = '0';
    panel.style.bottom = '0';
}

//  Tab activation helpers 
export function activateInvestigatorTab(subNav, sectionController, panel, navItem) {
    sectionController.classList.add('mi-panel-hidden');
    panel.classList.remove('mi-panel-hidden');
    navItem.setAttribute('active', 'true');
    subNav.querySelectorAll('lol-uikit-navigation-item').forEach(item => {
        if (item.id !== INVESTIGATOR_TAB_ID) item.removeAttribute('active');
    });
    const backdrop = document.querySelector('.style-profile-backdrop-container');
    if (backdrop) backdrop.classList.add('style-profile-backdrop-dimmed');
}

export function deactivateInvestigatorTab(sectionController, panel, navItem) {
    sectionController.classList.remove('mi-panel-hidden');
    panel.classList.add('mi-panel-hidden');
    navItem.removeAttribute('active');
    const backdrop = document.querySelector('.style-profile-backdrop-container');
    if (backdrop) backdrop.classList.remove('style-profile-backdrop-dimmed');
}

//  DOM injectors (called by MutationObserver in index.js) 
export function injectInvestigatorTab() {
    const viewportMain = document.querySelector('section.rcp-fe-viewport-main');
    if (!viewportMain) return;
    if (viewportMain.querySelector(`#${INVESTIGATOR_TAB_ID}`)) return; // already injected

    const subNav = viewportMain.querySelector('lol-uikit-navigation-bar.style-profile-sub-nav');
    if (!subNav) return;
    const profileRoot = viewportMain.querySelector('.rcp-fe-lol-profiles-main');
    if (!profileRoot) return;
    const sectionController = profileRoot.querySelector('lol-uikit-section-controller');
    if (!sectionController) return;

    const panel = document.createElement('div');
    panel.id        = INVESTIGATOR_PANEL_ID;
    panel.className = 'mi-panel-hidden';
    panel.appendChild(buildInvestigatorDashboard());
    profileRoot.appendChild(panel);
    requestAnimationFrame(() => positionPanel(panel, subNav, profileRoot));

    const navItem = document.createElement('lol-uikit-navigation-item');
    navItem.id = INVESTIGATOR_TAB_ID;
    navItem.setAttribute('priority', '10');
    navItem.textContent = 'Mayhem Investigator';
    subNav.appendChild(navItem);

    navItem.addEventListener('click', () => {
        positionPanel(panel, subNav, profileRoot);
        activateInvestigatorTab(subNav, sectionController, panel, navItem);
    });

    subNav.querySelectorAll('lol-uikit-navigation-item').forEach(item => {
        if (item.id === INVESTIGATOR_TAB_ID) return;
        item.addEventListener('click', () => deactivateInvestigatorTab(sectionController, panel, navItem));
    });
}

export function injectMatchHistoryButton() {
    const mainViewport   = document.querySelector('section.rcp-fe-viewport-main');
    const injectionPoint = mainViewport ? mainViewport.querySelector('.match-history-left-title') : null;
    if (!injectionPoint || mainViewport.querySelector('.aram-controls-wrapper')) return;

    const wrapper  = document.createElement('div');  wrapper.className  = 'aram-controls-wrapper';
    const btn      = document.createElement('button'); btn.textContent   = 'Mayhem!'; btn.className = 'aram-btn-start';
    const slider   = document.createElement('input');  slider.type       = 'range'; slider.min = '10'; slider.max = '400'; slider.value = 50;
    const numInput = document.createElement('input');  numInput.type     = 'number'; numInput.value = 50; numInput.className = 'aram-number-input';
    slider.oninput   = () => { numInput.value = slider.value; };
    numInput.oninput = () => { slider.value   = numInput.value; };
    wrapper.append(slider, numInput, btn);
    injectionPoint.insertAdjacentElement('afterend', wrapper);

    btn.onclick = () => {
        const count        = parseInt(numInput.value) || 50;
        const modalContent = createModal();
        modalContent.innerHTML = '<h2>Analyzing…</h2><p id="analysis-status">Initializing…</p>';

        startSelfAnalysis((update) => {
            const statusEl = modalContent.querySelector('#analysis-status');
            if (statusEl && update.status) statusEl.textContent = update.status;
            if (statusEl && update.error)  statusEl.textContent = `Error: ${update.error}`;
            if (update.finalStats) displayStats(modalContent, update.finalStats, update.fullHistory);
        }, count);
    };
}