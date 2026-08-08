/**
 * Generic sortable/clickable/collapsible table widget. Reusable in any plugin.
 *
 * @param {Array<{ label, key, render? }>} columns
 * @param {Array<object>}                  data
 * @param {string|null}                    defaultSortKey
 * @param {boolean}                        defaultSortAsc
 * @param {Function|null}                  onRowClick (row, event) => void
 * @returns {HTMLTableElement}
 */

import { wilsonLowerBound } from '../analysis.js';

export function createInteractiveTable(columns, data, defaultSortKey = null, defaultSortAsc = false, onRowClick = null) {
    const table = document.createElement('table');
    table.className = 'aram-sortable-table';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    let sortKey = defaultSortKey || columns[1].key;
    let sortAsc = defaultSortAsc;
    let collapsed = false;

    // Collapse toggle cell
    const collapseCell = document.createElement('th');
    collapseCell.className = 'aram-collapse-cell';
    collapseCell.innerHTML = '<span class="aram-collapse-icon">▾</span>';
    collapseCell.title = 'Collapse / expand';
    collapseCell.onclick = (e) => {
        e.stopPropagation();
        collapsed = !collapsed;
        tbody.style.display = collapsed ? 'none' : '';
        collapseCell.querySelector('.aram-collapse-icon').textContent = collapsed ? '▸' : '▾';
        table.classList.toggle('aram-table-collapsed', collapsed);
    };

    const trHead = document.createElement('tr');
    trHead.appendChild(collapseCell);

    columns.forEach(col => {
        const th = document.createElement('th');
        th.innerHTML = `${col.label} <span class="aram-sort-icon"></span>`;
        th.onclick = () => {
            if (sortKey === col.key) sortAsc = !sortAsc;
            else { sortKey = col.key; sortAsc = false; }
            renderBody();
            updateHeaderStyles();
        };
        trHead.appendChild(th);
    });

    thead.appendChild(trHead);

    const updateHeaderStyles = () => {
        Array.from(trHead.children).forEach((e, i) => {
            if (i === 0) return;
            e.className = '';
            if (columns[i - 1].key === sortKey) e.className = sortAsc ? 'aram-sorted-asc' : 'aram-sorted-desc';
        });
    };

    const renderBody = () => {
        tbody.innerHTML = '';
        data.sort((a, b) => {
            let valA = a[sortKey], valB = b[sortKey];

            // Smart Sort for Win Rate: Wilson 95% lower confidence bound
            if (sortKey === 'winRate' && a.games !== undefined && b.games !== undefined) {
                const scoreA = wilsonLowerBound(a.wins ?? 0, a.games);
                const scoreB = wilsonLowerBound(b.wins ?? 0, b.games);
                if (scoreA !== scoreB) return sortAsc ? scoreA - scoreB : scoreB - scoreA;
                return sortAsc ? a.games - b.games : b.games - a.games;
            }

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            return valA < valB ? (sortAsc ? -1 : 1) : valA > valB ? (sortAsc ? 1 : -1) : 0;
        });
        data.forEach(row => {
            const tr = document.createElement('tr');
            if (onRowClick) {
                tr.classList.add('aram-match-row');
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', (e) => onRowClick(row, e));
            }
            const spacer = document.createElement('td');
            spacer.className = 'aram-collapse-spacer';
            tr.appendChild(spacer);

            columns.forEach(col => {
                const td = document.createElement('td');
                if (col.render) td.innerHTML = col.render(row);
                else td.textContent = row[col.key];
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    };

    renderBody();
    updateHeaderStyles();
    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
}

/**
 * Attaches a search button to an existing section title element and returns
 * a filter function. Renders a collapsible input row between the title and the
 * table, filtering tableData by the given key and re-rendering via renderFn.
 *
 * @param {HTMLElement}  titleEl    the .sc-section-title h3
 * @param {Array}        tableData  the full data array passed to createInteractiveTable
 * @param {string}       searchKey  field on each row to match against
 * @param {Function}     renderFn   called with (filteredData) to rebuild the table
 */
export function attachTableSearch(titleEl, tableData, searchKey, renderFn) {
    const btn = document.createElement('button');
    btn.className = 'aram-table-search-btn';
    btn.textContent = '⌕';
    btn.title = 'Search';
    titleEl.appendChild(btn);

    let bar = null;
    let input = null;

    const close = () => {
        btn.classList.remove('aram-table-search-btn--active');
        if (bar) {
            bar.remove();
            bar = null;
            input = null;
            renderFn(tableData);
        }
    };

    btn.addEventListener('click', () => {
        if (bar) { close(); return; }

        bar = document.createElement('div');
        bar.className = 'aram-table-search-bar';

        input = document.createElement('input');
        input.type = 'text';
        input.className = 'aram-table-search-bar-input';
        input.placeholder = 'Type to filter…';
        input.setAttribute('autocomplete', 'off');
        bar.appendChild(input);
        titleEl.insertAdjacentElement('afterend', bar);

        input.addEventListener('input', () => {
            const needle = input.value.toLowerCase();
            const filtered = needle
                ? tableData.filter(r => String(r[searchKey] ?? '').toLowerCase().includes(needle))
                : tableData;
            renderFn(filtered);
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'Escape') close();
        });

        btn.classList.add('aram-table-search-btn--active');
        input.focus();
    });
}