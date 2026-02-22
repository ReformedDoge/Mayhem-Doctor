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
        // offset by 1 to account for the collapse cell
        Array.from(trHead.children).forEach((e, i) => {
            if (i === 0) return; // skip collapse cell
            e.className = '';
            if (columns[i - 1].key === sortKey) e.className = sortAsc ? 'aram-sorted-asc' : 'aram-sorted-desc';
        });
    };

    const renderBody = () => {
        tbody.innerHTML = '';
        data.sort((a, b) => {
            let valA = a[sortKey], valB = b[sortKey];
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
            // Spacer td to align with the collapse cell column
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