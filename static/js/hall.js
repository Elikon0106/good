/**
 * Digital Bridge — Interactive Hall SVG Renderer (1280×1280)
 * Renders the hall layout matching the venue photograph.
 */

let allSeats = [];
let selectedSeatId = null;
let dashboardQR = null;
let hallConfig = null;

// ================================================================
// Hall Geometry Constants (matching photograph, 1280×1280 viewBox)
// ================================================================
const HALL = {
    vw: 1280, vh: 1280,
    // Hall frame (truss perimeter)
    frame: { x: 187, y: 47, w: 928, h: 1190 },
    // Stage
    stage: { x1: 353, y1: 103, x2: 950, y2: 295, bevel: 40 },
    // Horizontal truss bar below stage
    trussBar: { y: 310, x1: 187, x2: 1115 },
    // Speakers/screens
    speakers: [
        { x: 430, y: 352, w: 36, h: 28 },
        { x: 835, y: 352, w: 36, h: 28 },
    ],
    // Sector geometry
    sectors: {
        left:   { x: 257, y: 564, rows: 20, seatsPerRow: 10, seatW: 16, seatH: 14, gapX: 2, gapY: 10 },
        center: { x: 505, y: 564, rows: 15, seatsPerRow: 16, seatW: 16, seatH: 14, gapX: 2, gapY: 10,
                  row1Seats: 13 },
        right:  { x: 862, y: 564, rows: 19, seatsPerRow: 10, seatW: 16, seatH: 14, gapX: 2, gapY: 10 },
    },
    // Control desk (non-interactive)
    controlDesk: { x: 540, y: 1125, w: 222, h: 60 },
    controlBox: { x: 611, y: 1060, w: 79, h: 53 },
    // Gray squares bottom-left
    graySquares: [
        { x: 140, y: 1063, w: 42, h: 42 },
        { x: 140, y: 1110, w: 42, h: 42 },
        { x: 140, y: 1157, w: 25, h: 33 },
    ],
    // Entrances
    entrances: [
        { id: 'A', label: 'Вход A', x: 470, y: 1210 },
        { id: 'Б', label: 'Вход Б', x: 830, y: 1210 },
    ],
};

function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
    return el;
}

// ================================================================
// Seat count helper
// ================================================================
function getSeatsInRow(sectorKey, row) {
    const s = HALL.sectors[sectorKey];
    if (sectorKey === 'center' && row === 1) return s.row1Seats;
    return s.seatsPerRow;
}

// ================================================================
// Calculate sector width
// ================================================================
function sectorWidth(sectorKey) {
    const s = HALL.sectors[sectorKey];
    return s.seatsPerRow * (s.seatW + s.gapX) - s.gapX;
}

// ================================================================
// Main Render
// ================================================================
function renderHall(svgId, seats) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${HALL.vw} ${HALL.vh}`);

    // === Background ===
    svg.appendChild(svgEl('rect', {
        x: 0, y: 0, width: HALL.vw, height: HALL.vh, fill: '#0a0a0a',
    }));

    // === Hall frame (truss perimeter) ===
    const f = HALL.frame;
    svg.appendChild(svgEl('rect', {
        x: f.x, y: f.y, width: f.w, height: f.h,
        fill: 'none', stroke: '#4a4a4a', 'stroke-width': 3, rx: 4,
    }));
    // Inner truss lines for realism
    svg.appendChild(svgEl('rect', {
        x: f.x + 5, y: f.y + 5, width: f.w - 10, height: f.h - 10,
        fill: 'none', stroke: '#3a3a3a', 'stroke-width': 1, rx: 2,
    }));

    // === Stage (trapezoid) ===
    const st = HALL.stage;
    const bv = st.bevel;
    const stagePath = `M ${st.x1} ${st.y1} L ${st.x2} ${st.y1} L ${st.x2} ${st.y2} L ${st.x2 - bv} ${st.y2} L ${st.x2 - bv - 10} ${st.y2 - 15} L ${st.x1 + bv + 10} ${st.y2 - 15} L ${st.x1 + bv} ${st.y2} L ${st.x1} ${st.y2} Z`;
    svg.appendChild(svgEl('path', {
        d: stagePath, fill: '#2a2a2a', stroke: '#555', 'stroke-width': 1,
    }));

    // Stage label
    const stageLabel = svgEl('text', {
        x: (st.x1 + st.x2) / 2, y: (st.y1 + st.y2) / 2 + 5,
        'text-anchor': 'middle', fill: '#666', 'font-size': '24', 'font-weight': '600',
    });
    stageLabel.textContent = t('СЦЕНА');
    svg.appendChild(stageLabel);

    // === Lighting trusses (diagonal beams from stage sides) ===
    // Left beam
    svg.appendChild(svgEl('line', {
        x1: st.x1, y1: st.y2 - 20, x2: st.x1 - 50, y2: st.y2 + 40,
        stroke: '#555', 'stroke-width': 4,
    }));
    // Right beam
    svg.appendChild(svgEl('line', {
        x1: st.x2, y1: st.y2 - 20, x2: st.x2 + 50, y2: st.y2 + 40,
        stroke: '#555', 'stroke-width': 4,
    }));

    // === Horizontal truss bar ===
    const tb = HALL.trussBar;
    svg.appendChild(svgEl('line', {
        x1: tb.x1, y1: tb.y, x2: tb.x2, y2: tb.y,
        stroke: '#4a4a4a', 'stroke-width': 3,
    }));
    svg.appendChild(svgEl('line', {
        x1: tb.x1, y1: tb.y + 10, x2: tb.x2, y2: tb.y + 10,
        stroke: '#3a3a3a', 'stroke-width': 2,
    }));
    // Cross braces on truss
    for (let bx = tb.x1; bx < tb.x2; bx += 30) {
        svg.appendChild(svgEl('line', {
            x1: bx, y1: tb.y, x2: bx + 15, y2: tb.y + 10,
            stroke: '#3a3a3a', 'stroke-width': 0.5,
        }));
    }

    // === Speakers ===
    for (const sp of HALL.speakers) {
        svg.appendChild(svgEl('rect', {
            x: sp.x, y: sp.y, width: sp.w, height: sp.h,
            fill: '#111', stroke: '#333', 'stroke-width': 1,
        }));
    }

    // === Seats ===
    const seatElements = {};
    for (const sectorKey of ['left', 'center', 'right']) {
        const sec = HALL.sectors[sectorKey];
        const secW = sectorWidth(sectorKey);

        // Sector label
        const lbl = svgEl('text', {
            x: sec.x + secW / 2, y: sec.y - 18,
            'text-anchor': 'middle', fill: '#94a3b8', 'font-size': '14', 'font-weight': '600',
        });
        const sectorLabel = hallConfig ? hallConfig[sectorKey].label : sectorKey;
        lbl.textContent = t(sectorLabel);
        svg.appendChild(lbl);

        for (let rowIdx = 0; rowIdx < sec.rows; rowIdx++) {
            const rowNum = rowIdx + 1;
            const y = sec.y + rowIdx * (sec.seatH + sec.gapY);
            const seatsInRow = getSeatsInRow(sectorKey, rowNum);

            // Normal rows
            const rowW = seatsInRow * (sec.seatW + sec.gapX) - sec.gapX;
            const xOffset = (secW - rowW) / 2;

            for (let num = 0; num < seatsInRow; num++) {
                const x = sec.x + xOffset + num * (sec.seatW + sec.gapX);
                const seatData = seats.find(s =>
                    s.sector === sectorKey && s.row === rowNum && s.number === num + 1
                );
                if (!seatData) continue;

                let seatClass = 'seat ';
                if (seatData.is_reserved) seatClass += 'seat-reserved';
                else if (seatData.is_occupied) seatClass += 'seat-occupied';
                else seatClass += 'seat-free';

                const rect = svgEl('rect', {
                    x: x, y: y,
                    width: sec.seatW, height: sec.seatH,
                    class: seatClass, rx: 3,
                    'data-seat-id': seatData.id,
                });
                const title = svgEl('title', {});
                if (seatData.is_reserved) {
                    title.textContent = `${t('Занято')} — ${t(seatData.sector_label)}, ${t('Ряд')} ${seatData.row}, ${t('Место')} ${seatData.number}`;
                } else if (seatData.is_occupied) {
                    title.textContent = `${seatData.guest_name} — ${t(seatData.sector_label)}, ${t('Ряд')} ${seatData.row}, ${t('Место')} ${seatData.number}`;
                } else {
                    title.textContent = `${t('Свободно')} — ${t(seatData.sector_label)}, ${t('Ряд')} ${seatData.row}, ${t('Место')} ${seatData.number}`;
                }
                rect.appendChild(title);
                rect.addEventListener('click', () => selectSeat(seatData.id));
                svg.appendChild(rect);
                seatElements[seatData.id] = rect;
            }
        }
    }

    // === Control desk ===
    const cd = HALL.controlDesk;
    svg.appendChild(svgEl('rect', {
        x: cd.x, y: cd.y, width: cd.w, height: cd.h,
        fill: '#d1d5db', rx: 4, opacity: 0.9,
    }));
    const cb = HALL.controlBox;
    svg.appendChild(svgEl('rect', {
        x: cb.x, y: cb.y, width: cb.w, height: cb.h,
        fill: '#e5e7eb', rx: 3, opacity: 0.8,
    }));

    // === Gray squares (bottom left) ===
    for (const gs of HALL.graySquares) {
        svg.appendChild(svgEl('rect', {
            x: gs.x, y: gs.y, width: gs.w, height: gs.h,
            fill: '#6b7280', rx: 2, opacity: 0.6,
        }));
    }

    // === Entrances ===
    for (const ent of HALL.entrances) {
        svg.appendChild(svgEl('rect', {
            x: ent.x - 35, y: ent.y - 12,
            width: 70, height: 26,
            class: 'entrance-marker', rx: 6,
        }));
        const el = svgEl('text', {
            x: ent.x, y: ent.y + 5,
            'text-anchor': 'middle', fill: 'white', 'font-size': '12', 'font-weight': '700',
        });
        el.textContent = t(ent.label);
        svg.appendChild(el);
    }

    // === Legend ===
    const legendY = HALL.vh - 30;
    const legendItems = [
        { color: '#22c55e', label: 'Свободно' },
        { color: '#3b82f6', label: 'Занято' },
        { color: '#eab308', label: 'Выбрано' },
        { color: '#ef4444', label: 'Ваше место' },
    ];
    let legendX = HALL.vw / 2 - 200;
    for (const item of legendItems) {
        svg.appendChild(svgEl('rect', {
            x: legendX, y: legendY - 6, width: 12, height: 12,
            fill: item.color, rx: 2,
        }));
        const lt = svgEl('text', {
            x: legendX + 18, y: legendY + 5,
            fill: '#9ca3af', 'font-size': '12',
        });
        lt.textContent = t(item.label);
        svg.appendChild(lt);
        legendX += 100;
    }

    return seatElements;
}

// ================================================================
// Seat helpers
// ================================================================
function getSeatClass(seatData) {
    if (seatData.is_reserved) return 'seat seat-reserved';
    if (seatData.is_occupied) return 'seat seat-occupied';
    return 'seat seat-free';
}

function getSeatPosition(seat) {
    const sec = HALL.sectors[seat.sector];
    const secW = sectorWidth(seat.sector);
    const seatsInRow = getSeatsInRow(seat.sector, seat.row);

    const rowW = seatsInRow * (sec.seatW + sec.gapX) - sec.gapX;
    const xOffset = (secW - rowW) / 2;
    return {
        x: sec.x + xOffset + (seat.number - 1) * (sec.seatW + sec.gapX) + sec.seatW / 2,
        y: sec.y + (seat.row - 1) * (sec.seatH + sec.gapY) + sec.seatH / 2,
    };
}

// ================================================================
// Seat Selection & Panel
// ================================================================
async function selectSeat(seatId) {
    const prevSelected = document.querySelector('.seat-selected');
    if (prevSelected) {
        prevSelected.classList.remove('seat-selected');
        const prevData = allSeats.find(s => s.id === parseInt(prevSelected.getAttribute('data-seat-id')));
        if (prevData) prevSelected.setAttribute('class', getSeatClass(prevData));
    }

    const seatEl = document.querySelector(`[data-seat-id="${seatId}"]`);
    if (seatEl && !seatEl.classList.contains('seat-highlight')) {
        seatEl.setAttribute('class', 'seat seat-selected');
    }

    selectedSeatId = seatId;

    try {
        const response = await fetch(`/api/seat/${seatId}`);
        const data = await response.json();
        showSeatPanel(data);
    } catch (err) {
        console.error('Failed to fetch seat info:', err);
    }
}

function showSeatPanel(data) {
    const panel = document.getElementById('side-panel');
    const content = document.getElementById('panel-content');
    panel.classList.remove('hidden-panel');
    panel.classList.add('visible-panel');

    if (data.is_reserved) {
        content.innerHTML = `
            <div class="space-y-5">
                <div class="bg-gray-800 rounded-xl p-4">
                    <p class="text-xs text-gray-400 mb-3">${t('Расположение')}</p>
                    <div class="grid grid-cols-3 gap-2 text-center">
                        <div class="bg-gray-700/50 rounded-lg p-2">
                            <p class="text-gray-400 text-xs">${t('Сектор')}</p>
                            <p class="text-white font-semibold text-sm">${t(data.sector_label)}</p>
                        </div>
                        <div class="bg-gray-700/50 rounded-lg p-2">
                            <p class="text-gray-400 text-xs">${t('Ряд')}</p>
                            <p class="text-white font-semibold text-lg">${data.row}</p>
                        </div>
                        <div class="bg-gray-700/50 rounded-lg p-2">
                            <p class="text-gray-400 text-xs">${t('Место')}</p>
                            <p class="text-white font-semibold text-lg">${data.number}</p>
                        </div>
                    </div>
                </div>
                <div class="text-center">
                    <span class="inline-block px-4 py-1.5 rounded-full text-sm font-medium
                        bg-blue-600/20 text-blue-300 border border-blue-600/30">
                        ● ${t('Занято')}
                    </span>
                </div>
            </div>`;
        return;
    }

    content.innerHTML = `
        <div class="space-y-5">
            <div class="bg-gray-800 rounded-xl p-4">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center ${data.is_occupied ? 'bg-blue-600/30' : 'bg-gray-700'}">
                        <svg class="w-5 h-5 ${data.is_occupied ? 'text-blue-400' : 'text-gray-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                    </div>
                    <div>
                        <p class="text-xs text-gray-400">${t('Гость')}</p>
                        <p class="text-white font-semibold">${data.guest_name || t('Не назначен')}</p>
                    </div>
                </div>
            </div>
            <div class="bg-gray-800 rounded-xl p-4">
                <p class="text-xs text-gray-400 mb-3">${t('Расположение')}</p>
                <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="bg-gray-700/50 rounded-lg p-2">
                        <p class="text-gray-400 text-xs">${t('Сектор')}</p>
                        <p class="text-white font-semibold text-sm">${t(data.sector_label)}</p>
                    </div>
                    <div class="bg-gray-700/50 rounded-lg p-2">
                        <p class="text-gray-400 text-xs">${t('Ряд')}</p>
                        <p class="text-white font-semibold text-lg">${data.row}</p>
                    </div>
                    <div class="bg-gray-700/50 rounded-lg p-2">
                        <p class="text-gray-400 text-xs">${t('Место')}</p>
                        <p class="text-white font-semibold text-lg">${data.number}</p>
                    </div>
                </div>
            </div>
            <div class="bg-gray-800/60 rounded-xl p-4 text-center">
                <p class="text-xs text-gray-400 mb-3">${t('QR-код — вход на сайт')}</p>
                <div class="qr-container mx-auto mb-3">
                    <img id="universal-qr" src="" alt="QR" class="w-36 h-36">
                </div>
                <p class="text-gray-500 text-xs">${t('Сканируйте для перехода на дашборд')}</p>
            </div>
            <div class="text-center">
                <span class="inline-block px-4 py-1.5 rounded-full text-sm font-medium ${
                    data.is_occupied
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                        : 'bg-green-600/20 text-green-300 border border-green-600/30'
                }">
                    ${data.is_occupied ? '● ' + t('Занято') : '○ ' + t('Свободно')}
                </span>
            </div>
        </div>`;

    const qrEl = document.getElementById('universal-qr');
    if (qrEl && dashboardQR) qrEl.src = dashboardQR;
}

function closePanel() {
    const panel = document.getElementById('side-panel');
    panel.classList.add('hidden-panel');
    panel.classList.remove('visible-panel');
    const selected = document.querySelector('.seat-selected');
    if (selected && selectedSeatId) {
        const data = allSeats.find(s => s.id === selectedSeatId);
        if (data) selected.setAttribute('class', getSeatClass(data));
    }
    selectedSeatId = null;
}

function updateStats(seats) {
    const reserved = seats.filter(s => s.is_reserved).length;
    const occupiedByGuest = seats.filter(s => s.is_occupied && !s.is_reserved).length;
    const free = seats.length - reserved - occupiedByGuest;
    const freeEl = document.getElementById('stats-free');
    const occEl = document.getElementById('stats-occupied');
    if (freeEl) freeEl.textContent = free;
    if (occEl) occEl.textContent = occupiedByGuest + reserved;
}

async function loadHall() {
    try {
        const configResp = await fetch('/api/hall-config');
        hallConfig = await configResp.json();

        const [seatsResp, qrResp] = await Promise.all([
            fetch('/api/seats'),
            fetch('/api/dashboard-qr'),
        ]);
        allSeats = await seatsResp.json();
        const qrData = await qrResp.json();
        dashboardQR = qrData.qr_image;
        renderHall('hall-svg', allSeats);
        updateStats(allSeats);
    } catch (err) {
        console.error('Failed to load hall data:', err);
    }
}

// ================================================================
// Search + Highlight
// ================================================================
let highlightedSeatId = null;

function searchGuests(query) {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return allSeats.filter(s =>
        !s.is_reserved && s.is_occupied && s.guest_name && s.guest_name.toLowerCase().includes(q)
    );
}

function highlightGuestSeat(seat) {
    clearHighlight();
    highlightedSeatId = seat.id;

    const seatEl = document.querySelector(`[data-seat-id="${seat.id}"]`);
    if (seatEl) {
        seatEl.setAttribute('class', 'seat seat-highlight');
        seatEl.style.fill = '#ef4444';
        seatEl.style.opacity = '1';
    }

    const svg = document.getElementById('hall-svg');
    if (!svg) return;

    const pos = getSeatPosition(seat);
    const entranceMap = { left: 'A', center: 'A', right: 'Б' };
    const myEntrance = entranceMap[seat.sector];
    const ent = HALL.entrances.find(e => e.id === myEntrance);
    if (!ent) return;

    const sec = HALL.sectors[seat.sector];
    const secW = sectorWidth(seat.sector);
    const sectorCenterX = sec.x + secW / 2;

    // Draw path: entrance → aisle → row → seat
    const pathPoints = [
        `${ent.x},${ent.y - 15}`,
        `${sectorCenterX},${ent.y - 40}`,
        `${sectorCenterX},${pos.y + 15}`,
        `${pos.x},${pos.y + 15}`,
        `${pos.x},${pos.y}`,
    ];

    svg.appendChild(svgEl('polyline', {
        points: pathPoints.join(' '),
        class: 'nav-path', id: 'guest-nav-path',
    }));

    svg.appendChild(svgEl('circle', {
        cx: pos.x, cy: pos.y, r: 14,
        fill: 'none', stroke: '#ef4444', 'stroke-width': 2,
        opacity: 0.8, id: 'guest-nav-circle',
        class: 'seat-highlight',
    }));

    const banner = document.getElementById('found-guest-banner');
    if (banner) {
        banner.classList.remove('hidden');
        document.getElementById('found-guest-name').textContent = seat.guest_name;
        document.getElementById('found-guest-sector').textContent = seat.sector_label;
        document.getElementById('found-guest-row').textContent = seat.row;
        document.getElementById('found-guest-number').textContent = seat.number;
    }
}

function clearHighlight() {
    if (highlightedSeatId) {
        const prevEl = document.querySelector(`[data-seat-id="${highlightedSeatId}"]`);
        if (prevEl) {
            const prevData = allSeats.find(s => s.id === highlightedSeatId);
            if (prevData) {
                prevEl.setAttribute('class', getSeatClass(prevData));
                prevEl.style.fill = '';
                prevEl.style.opacity = '';
            }
        }
        highlightedSeatId = null;
    }
    const path = document.getElementById('guest-nav-path');
    const circle = document.getElementById('guest-nav-circle');
    if (path) path.remove();
    if (circle) circle.remove();
}

function clearGuestSearch() {
    clearHighlight();
    const banner = document.getElementById('found-guest-banner');
    if (banner) banner.classList.add('hidden');
    const input = document.getElementById('guest-search-input');
    if (input) input.value = '';
    const results = document.getElementById('search-results');
    if (results) results.classList.add('hidden');
}

function initSearch() {
    const input = document.getElementById('guest-search-input');
    const resultsDiv = document.getElementById('search-results');
    if (!input || !resultsDiv) return;

    input.addEventListener('input', function() {
        const query = this.value.trim();
        const matches = searchGuests(query);

        if (matches.length === 0) {
            if (query.length >= 2) {
                resultsDiv.innerHTML = `<div class="px-4 py-3 text-sm text-gray-500">${t('Не найдено')}</div>`;
                resultsDiv.classList.remove('hidden');
            } else {
                resultsDiv.classList.add('hidden');
            }
            return;
        }

        resultsDiv.innerHTML = matches.slice(0, 15).map(s => `
            <button class="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 transition-colors flex items-center justify-between"
                    onclick="selectSearchResult(${s.id})">
                <span class="text-white font-medium">${s.guest_name} ${s.guest_category ? `<span class="text-xs text-blue-400 ml-2 border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 rounded">${s.guest_category}</span>` : ''}</span>
                <span class="text-gray-400 text-xs">${s.sector_label}, Р${s.row} М${s.number}</span>
            </button>
        `).join('');
        resultsDiv.classList.remove('hidden');
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('#search-wrapper')) resultsDiv.classList.add('hidden');
    });
}

function selectSearchResult(seatId) {
    const seat = allSeats.find(s => s.id === seatId);
    if (!seat) return;
    const input = document.getElementById('guest-search-input');
    if (input) input.value = seat.guest_name;
    const resultsDiv = document.getElementById('search-results');
    if (resultsDiv) resultsDiv.classList.add('hidden');
    highlightGuestSeat(seat);
    selectSeat(seatId);
}

document.addEventListener('DOMContentLoaded', async function() {
    await loadHall();
    initSearch();

    // Re-render hall when language changes
    window.addEventListener('languageChanged', () => {
        if (allSeats.length > 0) {
            renderHall('hall-svg', allSeats);
            updateStats(allSeats);
        }
    });
});
