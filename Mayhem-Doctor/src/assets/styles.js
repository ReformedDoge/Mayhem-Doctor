export const STYLES = `
/* BASE.CSS */
.aram-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(10, 10, 20, 0.85);
    backdrop-filter: blur(5px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s;
}

.aram-modal-content {
    background: #010a13;
    border: 2px solid #785a28;
    padding: 30px;
    width: 90%;
    max-width: 1500px;
    height: 90vh;
    overflow-y: auto;
    color: #c4b998;
    font-family: "Beaufort for LOL", serif;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
    position: relative;
}

.aram-modal-content h2 {
    color: #f0e6d2;
    border-bottom: 1px solid #c8aa6e;
    padding-bottom: 15px;
    margin-top: 0;
}

.aram-modal-content h3 {
    color: #c8aa6e;
    margin-top: 30px;
    margin-bottom: 10px;
    font-size: 18px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.aram-sortable-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 14px;
}

.aram-sortable-table th {
    font-weight: bold;
    color: #f0e6d2;
    text-align: left;
    padding: 12px;
    background: rgba(200, 170, 110, 0.15);
    border-bottom: 2px solid #c8aa6e;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
}

.aram-sortable-table th:hover {
    background: rgba(200, 170, 110, 0.3);
    color: #fff;
}

.aram-sortable-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid #2c353b;
    vertical-align: middle;
}

.aram-sortable-table tr:hover {
    background: rgba(255, 255, 255, 0.05);
}

.aram-sort-icon {
    font-size: 10px;
    margin-left: 5px;
    opacity: 0.5;
}

.aram-sorted-asc .aram-sort-icon::after  { content: "▲"; opacity: 1; }
.aram-sorted-desc .aram-sort-icon::after { content: "▼"; opacity: 1; }

.aram-modal-close {
    position: absolute;
    top: 15px;
    right: 20px;
    font-size: 40px;
    color: #888;
    cursor: pointer;
    line-height: 20px;
    z-index: 10001;
    pointer-events: all;
}

.aram-modal-close:hover { color: #fff; }

.aram-modal-home {
    position: absolute;
    top: 14px;
    right: 55px;
    color: #888;
    cursor: pointer;
    z-index: 10001;
    pointer-events: all;
    transition: color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.aram-modal-home:hover { color: #fff; }
.aram-modal-home svg { width: 22px; height: 22px; }


.aram-icon-cell {
    display: flex;
    align-items: center;
    gap: 10px;
}

.aram-icon {
    width: 32px;
    height: 32px;
    border: 1px solid #c8aa6e;
    border-radius: 4px;
    object-fit: cover;
    background: #000;
}

.aram-win-high  { color: #2de0a5; font-weight: bold; }
.aram-win-low   { color: #e04f5f; }
.aram-dash      { color: #c4b998; }
.aram-winrate   { color: #c4b998; }
.aram-remake-count { color: #888; }

.aram-summary-bar {
    font-size: 18px;
    margin-bottom: 20px;
}

.aram-controls-wrapper {
    display: flex;
    align-items: center;
    gap: 15px;
    margin: 10px 0;
    padding: 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #3c3c3c;
    border-radius: 5px;
}

.aram-btn-start {
    background: #1e282d;
    border: 1px solid #0acbe6;
    color: #cdbe91;
    padding: 0 20px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
    font-family: "Beaufort for LOL", serif;
    letter-spacing: 0.5px;
}

.aram-btn-start:hover:not(:disabled) {
    background: #0acbe6;
    color: #000;
}

.aram-btn-start:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.aram-number-input {
    background: #111;
    border: 1px solid #555;
    color: #f0e6d2;
    width: 60px;
    padding: 4px;
    text-align: center;
    font-family: "Beaufort for LOL", serif;
}

.aram-tab-bar {
    display: flex;
    border-bottom: 2px solid #785a28;
    margin-bottom: 20px;
}

.aram-tab-item {
    padding: 10px 20px;
    cursor: pointer;
    font-size: 16px;
    color: #888;
    position: relative;
    font-weight: bold;
    transition: color 0.2s;
    user-select: none;
}

.aram-tab-item:hover { color: #f0e6d2; }

.aram-tab-item.active {
    color: #f0e6d2;
    border-bottom: 2px solid #c8aa6e;
    margin-bottom: -2px;
}

.aram-tab-content          { display: none; animation: fadeIn 0.3s; }
.aram-tab-content.active   { display: block; }

.remake-indicator { color: #888; font-weight: bold; }

.aram-version-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #2c353b;
    border: 1px solid #555;
    color: #888;
    font-size: 11px;
    font-weight: bold;
    cursor: help;
    transition: border-color 0.2s, color 0.2s;
}

.aram-version-badge:hover {
    border-color: #c8aa6e;
    color: #c8aa6e;
}

.aram-sortable-table td:last-child,
.aram-sortable-table th:last-child {
    text-align: center;
    width: 36px;
}

.pf-wrapper {
    position: absolute;
    top: 44px;
    right: 25px;
    z-index: 50;
    font-size: 12px;
}

.pf-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid #3a3a3a;
    border-radius: 20px;
    color: #888;
    font-size: 11px;
    cursor: pointer;
    letter-spacing: 0.3px;
    transition: border-color 0.15s, color 0.15s;
    white-space: nowrap;
}

.pf-pill:hover {
    border-color: #785a28;
    color: #c4b998;
}

.pf-pill.pf-filtered {
    border-color: #c8aa6e;
    color: #c8aa6e;
}

.pf-icon {
    font-size: 10px;
    opacity: 0.7;
}

.pf-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 160px;
    background: #1a1a1a;
    border: 1px solid #3a3a3a;
    border-radius: 4px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
    overflow: hidden;
    z-index: 100;
}

.pf-hidden {
    display: none;
}

.pf-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 10px 6px;
    border-bottom: 1px solid #2c353b;
    background: rgba(200, 170, 110, 0.05);
}

.pf-header-label {
    flex: 1;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #666;
}

.pf-toggle-all,
.pf-toggle-none {
    font-size: 10px;
    color: #888;
    cursor: pointer;
    padding: 1px 4px;
    border-radius: 2px;
    transition: color 0.1s;
}

.pf-toggle-all:hover,
.pf-toggle-none:hover {
    color: #c8aa6e;
}

.pf-sep {
    color: #444;
    font-size: 10px;
}

.pf-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px;
    cursor: pointer;
    transition: background 0.1s;
}

.pf-row:hover {
    background: rgba(200, 170, 110, 0.07);
}

.pf-row input[type="checkbox"] {
    accent-color: #c8aa6e;
    cursor: pointer;
    width: 13px;
    height: 13px;
    flex-shrink: 0;
}

.pf-patch-label {
    color: #c4b998;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.3px;
}

.aram-collapse-cell {
    width: 22px;
    min-width: 22px;
    text-align: center;
    cursor: pointer;
    padding: 0 4px !important;
    user-select: none;
}

.aram-collapse-cell:hover .aram-collapse-icon {
    color: #c8aa6e;
}

.aram-collapse-icon {
    font-size: 25px;
    color: #555;
    transition: color 0.15s;
    display: inline-block;
    line-height: 1;
}

.aram-collapse-spacer {
    width: 22px;
    min-width: 22px;
    padding: 0 !important;
}

.aram-table-collapsed thead tr {
    opacity: 0.6;
}

.aram-table-collapsed .aram-collapse-cell {
    opacity: 1;
}

.aram-credits {
    margin-top: 40px;
    padding-top: 10px;
    border-top: 1px solid #1e1e1e;
    text-align: center;
    font-size: 11px;
    color: #333;
    letter-spacing: 0.5px;
    user-select: none;
}

/* CHAMPIONS.CSS */
.sc-root {
}

.sc-hidden {
    display: none !important;
}

.sc-search-input {
    width: 100%;
    box-sizing: border-box;
    background: #0a1520;
    border: 1px solid #3a4a55;
    border-bottom: 2px solid #c8aa6e;
    color: #f0e6d2;
    padding: 10px 14px;
    font-size: 16px;
    font-family: "Beaufort for LOL", serif;
    outline: none;
    margin-bottom: 18px;
    transition: border-color 0.2s;
    letter-spacing: 0.5px;
}

.sc-search-input:focus {
    border-color: #0acbe6;
    border-bottom-color: #0acbe6;
}

.sc-search-input::placeholder {
    color: #4a5a65;
}

.sc-champion-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.sc-champ-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    padding: 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    transition: background 0.15s, border-color 0.15s;
    width: 72px;
}

.sc-champ-cell:hover {
    background: rgba(200, 170, 110, 0.12);
    border-color: #c8aa6e;
}

.sc-champ-icon {
    width: 52px;
    height: 52px;
    border: 1px solid #785a28;
    border-radius: 4px;
    object-fit: cover;
    background: #000;
    transition: border-color 0.15s;
}

.sc-champ-cell:hover .sc-champ-icon {
    border-color: #c8aa6e;
}

.sc-champ-name {
    font-size: 10px;
    color: #c4b998;
    text-align: center;
    line-height: 1.2;
    max-width: 68px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sc-champ-games {
    font-size: 10px;
    color: #888;
    text-align: center;
}

.sc-no-results {
    color: #888;
    font-size: 14px;
    padding: 20px 0;
}

.sc-detail-view {
    animation: fadeIn 0.2s;
}

.sc-back-btn {
    margin-bottom: 16px;
}

.sc-detail-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 24px;
    padding-bottom: 18px;
    border-bottom: 1px solid #c8aa6e;
}

.sc-detail-icon {
    width: 80px;
    height: 80px;
    border: 2px solid #c8aa6e;
    border-radius: 6px;
    object-fit: cover;
    background: #000;
    flex-shrink: 0;
}

.sc-detail-champ-name {
    font-size: 26px;
    color: #f0e6d2;
    font-weight: bold;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 2px;
}

.sc-detail-stats {
    font-size: 15px;
    color: #c4b998;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
}

.sc-detail-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
    margin-top: 4px;
}

.sc-detail-col h3 {
    color: #c8aa6e;
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 15px;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid #2c353b;
    padding-bottom: 8px;
}

.sc-combo-row {
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid #2c353b;
}

.sc-empty {
    color: #666;
    font-size: 13px;
    margin: 8px 0;
}

.sc-combo-subgroup {
    margin-bottom: 16px;
}

.sc-combo-sublabel {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
    margin-bottom: 6px;
}

.sc-combo-cards {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.sc-combo-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #2c353b;
    border-radius: 3px;
    transition: border-color 0.15s, background 0.15s;
}

.sc-combo-card:hover {
    border-color: #785a28;
    background: rgba(200, 170, 110, 0.06);
}

.sc-combo-rank {
    font-size: 11px;
    color: #888;
    font-weight: bold;
    min-width: 20px;
    text-align: center;
    flex-shrink: 0;
}

.sc-combo-chips {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
}

.sc-combo-chip {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.sc-combo-chip--aug {
    width: 140px;
}

.sc-combo-name {
    font-size: 11px;
    color: #c4b998;
    white-space: nowrap;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sc-combo-name--aug {
    max-width: none;
    width: 104px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: inline-block;
}

.sc-combo-plus {
    color: #785a28;
    font-size: 11px;
    font-weight: bold;
    flex-shrink: 0;
    padding: 0 1px;
}

.sc-combo-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    min-width: 54px;
    flex-shrink: 0;
}

.sc-combo-games {
    font-size: 11px;
    color: #555;
}

.sc-combo-chips--aug {
    flex-wrap: nowrap;
    overflow: hidden;
}

.sc-aug-silver   { border: 1px solid #7a8fa6; }
.sc-aug-gold     { border: 1px solid #c8aa6e; }
.sc-aug-prismatic { border: 1px solid #a06ddb; }

.sc-rarity-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
    flex-shrink: 0;
}
.sc-rarity-dot.sc-aug-silver   { background: #7a8fa6; border: none; }
.sc-rarity-dot.sc-aug-gold     { background: #c8aa6e; border: none; }
.sc-rarity-dot.sc-aug-prismatic { background: #a06ddb; border: none; }

.sc-section-title {
    color: #c8aa6e;
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid #2c353b;
    padding-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.sc-section-title--pairs {
    margin-top: 20px;
}

.sc-model-badge {
    font-size: 9px;
    font-weight: normal;
    letter-spacing: 0.5px;
    color: #888;
    background: rgba(255,255,255,0.05);
    border: 1px solid #3a3a3a;
    border-radius: 3px;
    padding: 1px 6px;
    text-transform: uppercase;
    vertical-align: middle;
}

.sc-suggested-build {
    background: rgba(160, 109, 219, 0.06);
    border: 1px solid rgba(160, 109, 219, 0.3);
    border-radius: 4px;
    padding: 12px 14px;
    margin-bottom: 4px;
}

.sc-suggested-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
}

.sc-suggested-chip {
    padding: 2px;
}

.sc-suggested-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 11px;
}

.sc-suggested-label {
    color: #666;
    font-style: italic;
    text-transform: none;
    letter-spacing: 0;
}

.sc-conf-high { color: #2de0a5; }
.sc-conf-mid  { color: #c8aa6e; }
.sc-conf-low  { color: #888;    }

/* INVESTIGATOR.CSS */
.mi-panel-hidden {
    display: none !important;
}

.mi-panel-overlay-hidden {
    display: none !important;
}

#mi-profile-panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px 28px 40px;
    box-sizing: border-box;
    color: #c4b998;
    font-family: "Beaufort for LOL", serif;
    animation: fadeIn 0.2s;
}

.mi-controls {
    display: flex;
    align-items: flex-end;
    gap: 20px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    padding: 14px 16px;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid #2c353b;
    width: fit-content;
}

.mi-input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.mi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
}

.mi-text-input {
    background: #0a1520;
    border: 1px solid #3a4a55;
    color: #f0e6d2;
    padding: 6px 10px;
    font-size: 13px;
    font-family: "Beaufort for LOL", serif;
    width: 200px;
    outline: none;
    transition: border-color 0.2s;
}

.mi-text-input:focus {
    border-color: #0acbe6;
}

.mi-text-input::placeholder { color: #4a5a65; }

.mi-slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.mi-slider {
    width: 130px;
    accent-color: #0acbe6;
    cursor: pointer;
}

.mi-btn {
    padding: 7px 22px;
    font-size: 13px;
}

.mi-status-bar {
    padding: 9px 14px;
    font-size: 13px;
    margin-bottom: 14px;
    border-left: 3px solid transparent;
    max-width: 700px;
}

.mi-status-hidden { display: none; }

.mi-status-info {
    background: rgba(10, 203, 230, 0.08);
    border-left-color: #0acbe6;
    color: #a0d8e0;
}

.mi-status-success {
    background: rgba(45, 224, 165, 0.08);
    border-left-color: #2de0a5;
    color: #2de0a5;
}

.mi-status-error {
    background: rgba(224, 79, 95, 0.1);
    border-left-color: #e04f5f;
    color: #e04f5f;
}

.mi-results { margin-top: 4px; }

.mi-results h2 {
    color: #f0e6d2;
    border-bottom: 1px solid #c8aa6e;
    padding-bottom: 12px;
    margin-top: 0;
    font-size: 18px;
}

.mi-results h3 {
    color: #c8aa6e;
    margin-top: 28px;
    margin-bottom: 8px;
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.cb-picker-buttons {
    display: flex;
    gap: 10px;
    margin-top: 8px;
}
.cb-picker-buttons .aram-btn-start {
    flex: 1;
}

/* MATCHVIEW.CSS */
.aram-match-view {
    animation: fadeIn 0.2s ease;
}

.aram-match-header {
    margin-bottom: 20px;
}

.aram-team-block {
    margin-bottom: 40px;
}

.aram-scoreboard {
    width: 100%;
    border-collapse: collapse;
}

.aram-scoreboard th,
.aram-scoreboard td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid #2a2a2a;
}

.aram-champ-cell {
    display: flex;
    align-items: center;
    gap: 8px;
}

.aram-champ-icon {
    width: 36px;
    height: 36px;
    border-radius: 6px;
}

.aram-item-icon {
    width: 24px;
    height: 24px;
    margin-right: 2px;
}

.aram-spell-icon {
    width: 22px;
    height: 22px;
}

.aram-damage-bar-wrapper {
    position: relative;
    background: #1a1a1a;
    height: 14px;
    border-radius: 4px;
}

.aram-damage-bar {
    background: linear-gradient(90deg, #00b4ff, #0078ff);
    height: 100%;
    border-radius: 4px;
}

.aram-damage-bar-wrapper span {
    position: absolute;
    right: 4px;
    top: -2px;
    font-size: 11px;
}

.aram-me {
    background: rgba(0, 120, 255, 0.12);
}

.aram-full-match-view { display: flex; flex-direction: column; gap: 5px; animation: fadeIn 0.2s ease;max-height: -webkit-fill-available;}
.fm-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; }
.fm-header-left { display: flex; align-items: center; gap: 15px; }
.fm-header h2 { margin: 0; font-size: 24px; text-transform: uppercase; }
.fm-victory { color: #01ce8a; }
.fm-defeat { color: #e84057; }
.fm-meta { color: #a09b8c; font-size: 13px; }

.fm-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; table-layout: fixed; }

.fm-table th:nth-child(1), .fm-table td:nth-child(1) { width: 220px; }
.fm-table th:nth-child(2), .fm-table td:nth-child(2) { width: 120px; }
.fm-table th:nth-child(3), .fm-table td:nth-child(3) { width: 90px; }
.fm-table th:nth-child(4), .fm-table td:nth-child(4) { width: 140px; }
.fm-table th:nth-child(5), .fm-table td:nth-child(5) { width: 200px; }
.fm-table th { padding: 8px; color: #a09b8c; font-weight: bolder; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #333; }
.fm-table td { padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fm-me td { background: rgba(255, 255, 255, 0.08); }

.fm-champ { display: flex; align-items: center; gap: 8px; }
.fm-champ img { width: 32px; height: 32px; border-radius: 50%; border: 1px solid #333; flex-shrink: 0; }
.fm-spells { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
.fm-spells img { width: 15px; height: 15px; border-radius: 3px; }

.fm-name-wrapper { display: flex; flex-direction: column; min-width: 0; }
.fm-name { color: #f0e6d2; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.copy-badge {
    font-size: 10px; color: #a09b8c; background: #1e2328; border: 1px solid #333;
    border-radius: 3px; padding: 0 4px; margin-top: 2px; cursor: pointer;
    width: fit-content; transition: 0.2s; display: flex; align-items: center; gap: 3px;
}
.copy-badge:hover { border-color: #c8aa6e; color: #f0e6d2; }
.copy-icon { width: 8px; height: 8px; fill: currentColor; }
.fm-items, .fm-augs { display: flex; gap: 3px; flex-wrap: nowrap; }
.fm-items img, .fm-augs img { width: 24px; height: 24px; border-radius: 4px; border: 1px solid #222; background: #111; }

.fm-bar-wrap { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #f0e6d2; }
.fm-bar-bg { flex-grow: 1; height: 6px; background: #1e2328; border-radius: 3px; overflow: hidden; }
.fm-bar-fill { height: 100%; transition: width 0.3s ease, background-color 0.3s ease; }

.fm-team-title { font-size: 15px; font-weight: bold; margin-bottom: 5px; margin-top: 10px; display: flex; justify-content: space-between;}
.fm-blue { color: #00a0e9; }
.fm-red { color: #e84057; }

.stat-header { display: flex; justify-content: space-between; align-items: center; width: 100%; user-select: none; }
.stat-arrow { cursor: pointer; padding: 0; color: #ffffff; font-weight: bolder; transition: 0.2s; width: 20px; text-align: center; }
.stat-arrow:hover { color: #f0e6d2; background: rgba(255,255,255,0.1); border-radius: 3px; }
.stat-label { flex-grow: 1; text-align: center; white-space: nowrap; }

/* SETTINGS TAB STYLES */
.md-settings-section-title { color: #c8aa6e; font-size: 15px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #2c353b; padding-bottom: 8px; margin-top: 28px; margin-bottom: 12px; }
.md-settings-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #1a1a1a; }
.md-settings-row-label { font-size: 14px; color: #f0e6d2; }

.md-toggle { position: relative; display: inline-block; width: 40px; height: 22px; cursor: pointer; }
.md-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.md-toggle-slider { position: absolute; inset: 0; background: #2c353b; border: 1px solid #3a4a55; border-radius: 22px; transition: 0.2s; }
.md-toggle-slider::before { content: ''; position: absolute; left: 3px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; background: #555; border-radius: 50%; transition: 0.2s; }
.md-toggle input:checked + .md-toggle-slider { background: rgba(10, 203, 230, 0.15); border-color: #0acbe6; }
.md-toggle input:checked + .md-toggle-slider::before { left: 21px; background: #0acbe6; }

.md-update-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: rgba(45, 224, 165, 0.08); border: 1px solid rgba(45, 224, 165, 0.3); border-radius: 4px; }
.md-update-banner-text { color: #2de0a5; font-size: 13px; }

/* CHAMPION GRID PILLS */
.sc-pill-container { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 15px; }
.sc-pill {
    padding: 4px 12px; background: rgba(0,0,0,0.4); border: 1px solid #3a3a3a;
    color: #888; font-size: 11px; font-weight: bold; text-transform: uppercase; cursor: pointer; border-radius: 4px;
}
.sc-pill:hover { border-color: #785a28; color: #c4b998; }
.sc-pill.active { border-color: #c8aa6e; color: #c8aa6e; background: rgba(200,170,110,0.1); }

/* HOME SCREEN LAYOUT */
.home-layout { display: flex; gap: 24px; align-items: stretch; min-height: 480px; }

.home-left { display: flex; flex-direction: column; gap: 20px; width: 360px; }
.home-right { flex: 1; display: flex; }

.mi-controls, .home-dash, .home-info { 
    display: flex; flex-direction: row; padding: 20px; 
    background: rgba(200, 170, 110, 0.03); border: 1px solid rgba(120, 90, 40, 0.2); 
    border-radius: 4px; box-sizing: border-box;
}

.home-layout { display: flex; gap: 20px; min-height: 480px; }
.home-left { width: 320px; display: flex; flex-direction: column; gap: 16px; }
.home-right { flex: 1; display: flex; flex-direction: column; }

.mi-controls { background: rgba(0,0,0,0.25); padding: 16px; gap: 16px; min-height: auto; }
.home-dash { flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
.home-info { padding: 16px; background: rgba(200, 170, 110, 0.02); flex: 1; display: flex; flex-direction: column; }

/* Left Panel Controls */
.mi-input-group { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.mi-slider-row { display: flex; align-items: center; gap: 12px; width: 100%; justify-content: space-between; }
.mi-slider { flex: 1; height: 4px; accent-color: #c8aa6e; cursor: pointer; min-width: 0; }
.aram-number-input { width: 50px; text-align: center; background: #010a13; border: 1px solid #785a28; color: #f0e6d2; padding: 5px; font-size: 13px; font-weight: bold; }

.cb-picker-buttons { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.cb-picker-buttons .aram-btn-start { 
    width: 100%; padding: 10px; font-size: 13px; font-weight: bold;
    background: linear-gradient(180deg, #1e282d 0%, #151b1f 100%);
}

#cb-riot-id-row { animation: fadeIn 0.3s; margin-top: 5px; border-top: 1px solid rgba(120, 90, 40, 0.2); padding-top: 12px; }
.mi-text-input { width: 100%; box-sizing: border-box; padding: 8px; background: #010a13; border: 1px solid #3a4a55; color: #f0e6d2; }

/* Dashboard Styles */
.dash-welcome { border-bottom: 1px solid rgba(120, 90, 40, 0.2); padding-bottom: 12px; }
.dash-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #785a28; }
.dash-summary { font-size: 22px; color: #f0e6d2; font-weight: bold; margin: 4px 0; }
.dash-trend { display: flex; align-items: center; }
.trend-dot { width: 7px; height: 7px; border-radius: 50%; background: #333; }
.trend-dot.win { background: #2de0a5; box-shadow: 0 0 6px rgba(45, 224, 165, 0.4); }
.trend-dot.loss { background: #e04f5f; }
.trend-dot.remake { background: #888; }
.trend-label { font-size: 9px; text-transform: uppercase; color: #4a6070; margin-left: 6px; font-weight: bold; }

/* Analytics Grid */
.dash-analytics-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.dash-analytic-item { 
    display: flex; flex-direction: column; gap: 2px; padding: 10px; 
    background: rgba(0,0,0,0.2); border: 1px solid rgba(120, 90, 40, 0.1); border-radius: 4px;
}
.analytic-label { font-size: 9px; text-transform: uppercase; color: #785a28; letter-spacing: 0.5px; }
.analytic-value { font-size: 14px; color: #f0e6d2; font-weight: bold; }

.dash-champs { display: flex; gap: 8px; margin-top: 8px;}
.dash-champ-card { 
    display: flex; align-items: center; gap: 8px; padding: 8px; 
    background: rgba(0,0,0,0.4); border: 1px solid #2c353b; border-radius: 4px; 
    flex: 1; min-width: 0; transition: transform 0.2s, border-color 0.2s;
}
.dash-champ-card:hover { transform: translateY(-2px); border-color: #785a28; }
.dash-champ-info { display: flex; flex-direction: column; min-width: 0; }
.dash-champ-stats { font-size: 12px; color: #c4b998; font-weight: bold; white-space: nowrap; }

/* Pro Tips Panel */
.info-tips { margin: 0; padding-left: 15px; color: #a0b4c8; font-size: 12px; line-height: 1.5; }
.info-tips li { margin-bottom: 10px; }
.info-tips li b { color: #c8aa6e; }

.branding-content { padding: 12px; background: rgba(0,0,0,0.25); border: 1px solid rgba(120, 90, 40, 0.15); border-radius: 4px; }
.branding-title { font-size: 16px; color: #f0e6d2; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
.branding-dev { font-size: 11px; color: #c8aa6e; margin-bottom: 6px; }
.branding-version { font-size: 10px; color: #4a6070; }

.dash-footer { 
    margin-top: auto; font-size: 11px; color: #4a6070; text-align: right; 
    font-style: italic; border-top: 1px solid rgba(120, 90, 40, 0.1); padding-top: 8px;
}

/* Match History Filter */
.mh-filter-container { margin-bottom: 16px; position: relative; display: flex; flex-direction: column; gap: 8px; }
.mh-filter-input-wrapper { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.4); border: 1px solid #3a4a55; padding: 4px 10px; border-radius: 4px; transition: border-color 0.2s; }
.mh-filter-input-wrapper:focus-within { border-color: #c8aa6e; }
.mh-filter-input { background: transparent; border: none; color: #f0e6d2; font-size: 13px; flex: 1; outline: none; padding: 6px 0; }
.mh-chips-container { display: flex; flex-wrap: wrap; gap: 6px; }
.mh-chip { 
    display: flex; align-items: center; gap: 6px; background: rgba(200, 170, 110, 0.1); 
    border: 1px solid rgba(200, 170, 110, 0.3); padding: 4px 8px; border-radius: 4px; 
    font-size: 11px; color: #f0e6d2; cursor: default; animation: fadeIn 0.2s;
}
.mh-chip-remove { cursor: pointer; color: #785a28; font-weight: bold; font-size: 14px; line-height: 1; }
.mh-chip-remove:hover { color: #c8aa6e; }
.mh-dropdown { 
    position: absolute; top: 100%; left: 0; right: 0; z-index: 100; 
    background: #010a13; border: 1px solid #785a28; max-height: 200px; 
    overflow-y: auto; display: none; margin-top: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.8);
}
.mh-dropdown-item { 
    display: flex; align-items: center; gap: 10px; padding: 8px 12px; 
    cursor: pointer; transition: background 0.2s; border-bottom: 1px solid rgba(120, 90, 40, 0.1);
}
.mh-dropdown-item:hover { background: rgba(200, 170, 110, 0.1); }
.mh-dropdown-item img { width: 24px; height: 24px; border-radius: 2px; }
.mh-dropdown-item .name { font-size: 13px; color: #c4b998; }

.sc-info-icon { 
    position: absolute; top: 4px; right: 4px; width: 14px; height: 14px; 
    border-radius: 50%; background: rgba(200, 170, 110, 0.2); 
    border: 1px solid rgba(200, 170, 110, 0.4); color: #c8aa6e; 
    font-size: 10px; font-weight: bold; line-height: 14px; text-align: center;
    cursor: pointer; opacity: 0.6; transition: opacity 0.2s, background 0.2s;
}
.sc-champ-cell:hover .sc-info-icon { opacity: 1; }
.sc-info-icon:hover { background: rgba(200, 170, 110, 0.4); border-color: #c8aa6e; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Readability Fixes for Tiny Labels */
.analytic-label,
.dash-label,
.trend-label,
.dash-footer,
.sc-sort-label,
.mi-label,
.pf-header-label,
.stat-label {
    font-family: "Spiegel", "LoL Display", sans-serif !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    color: #a09b8c !important;
    letter-spacing: 0.05em !important;
    text-transform: uppercase;
}

.analytic-value {
    font-family: "Spiegel", "LoL Display", sans-serif !important;
    font-size: 14px !important;
    font-weight: 700 !important;
    color: #f0e6d2 !important;
}

.dash-label {
    font-size: 13px !important;
    color: #c8aa6e !important;
}
`