/**
 * @name Mayhem-Doctor
 * @version 1.0.0
 * @author SnoozeFest - github@ReformedDoge
 *
 * Entry point
 */

import './src/assets/base.css';
import './src/assets/champions.css';
import './src/assets/investigator.css';
import './src/assets/matchView.css';
import aramIcon from './src/assets/aram.svg?raw';

import { loadStaticData } from './src/lcu.js';
import { readCacheIndex, clearAllCache } from './src/cache.js';
import { openCommandBarModal } from './src/ui/modal.js';
import { injectMatchHistoryButton, injectInvestigatorTab, INVESTIGATOR_PANEL_ID } from './src/ui/investigator.js';

export async function load() {
    await loadStaticData();

    const observer = new MutationObserver(() => {
        injectMatchHistoryButton();
        injectInvestigatorTab();

        // Hide the investigator panel when a friend-profile overlay is open
        const panel = document.getElementById(INVESTIGATOR_PANEL_ID);
        if (panel) {
            const modalHasContent = document.querySelector('lol-uikit-full-page-modal .rcp-fe-lol-profiles-modal');
            if (modalHasContent) panel.classList.add('mi-panel-overlay-hidden');
            else                 panel.classList.remove('mi-panel-overlay-hidden');
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Resize the SVG for CommandBar display
    const smallAramIcon = aramIcon
        .replace(/<\?xml.*?\?>/, '')
        .replace('<svg', '<svg viewBox="0 0 400 400" style="width:25px;height:25px;min-width:25px;min-height:25px;margin-right:6px;vertical-align:bottom;')
        .replace(/width=".*?"/, '')
        .replace(/height=".*?"/, '');

    /*
     * CommandBar action interface:
     *   id?      unique identifier
     *   name     action's name
     *   legend?  note / shortcut key
     *   tags?    keywords for search
     *   icon?    <svg> HTML string
     *   group?   group name
     *   hidden?  hide except in search results
     *   perform? called when action is executed
     */
    CommandBar.addAction({
        id:      'mayhem-doctor',
        name:    'Mayhem Doctor',
        legend:  'Mayhem Match History Analyzer!',
        icon:    smallAramIcon,
        tags:    ['aram', 'doctor', 'Analyzer', 'mayhem', 'stats', 'analysis', 'winrate'],
        group:   'ARAM',
        perform: () => openCommandBarModal()
    });

    CommandBar.addAction({
        id:      'mayhem-doctor-clear-cache',
        name:    'Mayhem Doctor — Clear Cache',
        legend:  'Wipes all cached match history',
        icon:    smallAramIcon,
        tags:    ['aram', 'mayhem', 'cache', 'clear', 'reset'],
        group:   'ARAM',
        perform: () => {
            try {
                const count = clearAllCache();
                Toast.success(`Mayhem Doctor: cleared cache for ${count} player${count !== 1 ? 's' : ''}.`);
            } catch (e) {
                Toast.error(`Mayhem Doctor: failed to clear cache — ${e.message}`);
            }
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.altKey && e.code === 'KeyX') {
            e.preventDefault();
            const existing = document.querySelector('.aram-modal-overlay');
            if (existing) existing.remove();
            else          openCommandBarModal();
        }
    });

    // Delay startup toast so it doesn't get swallowed by client boot
    setTimeout(() => {
        Toast.success('Mayhem Doctor is ready!  •  Press Alt + X to open');
    }, 8000);
}
