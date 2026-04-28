/**
 * Floating patch-version filter pill + dropdown with checkbox list.
 *
 * - Extracts Major.Minor from full gameVersion strings (e.g. "15.8.694.9999" → "15.8")
 * - Defaults all patches to selected (stores only the *excluded* set so new patches
 *   discovered in future fetches are automatically included)
 * - Persists exclusions to DataStore under "md-patch-filter" so the preference
 *   survives client restarts
 */

const DATASTORE_KEY = 'md-patch-filter';

//  Helpers 
// "15.8.694.9999" → "15.8"
export function toPatchLabel(gameVersion = '') {
    const parts = gameVersion.split('.');
    return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : gameVersion || 'Unknown';
}

/** Sorted descending (newest first) from a Set or Array of patch labels */
function sortedPatches(patchSet) {
    return [...patchSet].sort((a, b) => {
        const [aMaj, aMin] = a.split('.').map(Number);
        const [bMaj, bMin] = b.split('.').map(Number);
        return bMaj !== aMaj ? bMaj - aMaj : bMin - aMin;
    });
}

//  DataStore persistence 
async function loadExcluded() {
    try {
        const raw = await DataStore.get(DATASTORE_KEY);
        return new Set(raw ? JSON.parse(raw) : []);
    } catch {
        return new Set();
    }
}

async function saveExcluded(excludedSet) {
    try {
        await DataStore.set(DATASTORE_KEY, JSON.stringify([...excludedSet]));
    } catch {
        // filter still works in-memory
    }
}

//  Component 
/**
 * Creates and returns a patch filter element.
 *
 * @param {string[]} allVersionStrings  Raw gameVersion values from fullHistory
 * @param {function} onChange           Called with (excludedSet: Set<string>) whenever selection changes
 * @returns {Promise<HTMLElement>}      The floating wrapper element, append anywhere
 */
export async function createPatchFilter(
    allVersionStrings,
    onChange,
    doc = document,
) {
    // Deduplicate + convert to Major.Minor labels
    const allPatches   = sortedPatches(new Set(allVersionStrings.map(toPatchLabel)));
    const excludedSet  = await loadExcluded();

    // Prune any stored exclusions that no longer exist in this dataset
    for (const exc of excludedSet) {
        if (!allPatches.includes(exc)) excludedSet.delete(exc);
    }

    const activeCount  = () => allPatches.length - excludedSet.size;
    const totalCount   = allPatches.length;

    //  DOM 
    const wrapper = doc.createElement('div');
    wrapper.className = 'pf-wrapper';

    const pill = doc.createElement('button');
    pill.className = 'pf-pill';
    pill.title    = 'Filter by patch';

    const dropdown = doc.createElement('div');
    dropdown.className = 'pf-dropdown pf-hidden';

    wrapper.appendChild(pill);
    wrapper.appendChild(dropdown);

    //  Label updater 
    function updatePill() {
        const active = activeCount();
        if (active === totalCount) {
            pill.innerHTML = `<span class="pf-icon">⬙</span> All Patches`;
            pill.classList.remove('pf-filtered');
        } else {
            pill.innerHTML = `<span class="pf-icon">⬙</span> ${active}/${totalCount} Patches`;
            pill.classList.add('pf-filtered');
        }
    }

    //  Dropdown builder 
    function buildDropdown() {
        dropdown.innerHTML = '';

        // Header row: "Patches" label + "All / None" toggles
        const header = doc.createElement('div');
        header.className = 'pf-header';
        header.innerHTML = `
            <span class="pf-header-label">Patches</span>
            <span class="pf-toggle-all">All</span>
            <span class="pf-sep">·</span>
            <span class="pf-toggle-none">None</span>
        `;
        dropdown.appendChild(header);

        header.querySelector('.pf-toggle-all').onclick = (e) => {
            e.stopPropagation();
            excludedSet.clear();
            rebuildCheckboxes();
            commit();
        };
        header.querySelector('.pf-toggle-none').onclick = (e) => {
            e.stopPropagation();
            allPatches.forEach(p => excludedSet.add(p));
            rebuildCheckboxes();
            commit();
        };

        rebuildCheckboxes();
    }

    function rebuildCheckboxes() {
        // Remove old checkbox rows, keep the header
        dropdown.querySelectorAll('.pf-row').forEach(el => el.remove());

        allPatches.forEach(patch => {
            const row = doc.createElement('label');
            row.className = 'pf-row';

            const cb = doc.createElement('input');
            cb.type    = 'checkbox';
            cb.checked = !excludedSet.has(patch);
            cb.onclick = (e) => e.stopPropagation();
            cb.onchange = () => {
                if (cb.checked) excludedSet.delete(patch);
                else            excludedSet.add(patch);
                updatePill();
                commit();
            };

            const label = doc.createElement('span');
            label.className   = 'pf-patch-label';
            label.textContent = patch;

            row.appendChild(cb);
            row.appendChild(label);
            dropdown.appendChild(row);
        });
    }

    // Commit changes 
    function commit() {
        updatePill();
        saveExcluded(excludedSet);
        onChange(new Set(excludedSet));
    }

    // Pill toggle 
    pill.onclick = (e) => {
        e.stopPropagation();
        const isOpen = !dropdown.classList.contains('pf-hidden');
        if (isOpen) {
            dropdown.classList.add('pf-hidden');
        } else {
            buildDropdown();
            dropdown.classList.remove('pf-hidden');
        }
    };

    // Close on outside click
    doc.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) dropdown.classList.add('pf-hidden');
    });

    // Init 
    updatePill();

    return { el: wrapper, excludedSet };
}
