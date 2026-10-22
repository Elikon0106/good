/**
 * Digital Bridge — Admin Panel JavaScript
 * Handles Excel upload, guest management, hall rendering for admin.
 * Config is fetched from /api/hall-config (single source of truth).
 */

let adminSeats = [];
let adminGuests = [];
let adminHallConfig = null; // loaded from API

// ================================================================
// Toast Notifications
// ================================================================

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ================================================================
// Hall Geometry Constants (matching photograph, 1280×1280 viewBox)
// ================================================================
const ADMIN_HALL = {
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

function getAdminSeatsInRow(sectorKey, row) {
    const s = ADMIN_HALL.sectors[sectorKey];
    if (sectorKey === 'center' && row === 1) return s.row1Seats;
    return s.seatsPerRow;
}

function adminSectorWidth(sectorKey) {
    const s = ADMIN_HALL.sectors[sectorKey];
    return s.seatsPerRow * (s.seatW + s.gapX) - s.gapX;
}

function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, val] of Object.entries(attrs)) {
        el.setAttribute(key, val);
    }
    return el;
}

function renderAdminHall(seats) {
    const svg = document.getElementById('admin-hall-svg');
    if (!svg || !adminHallConfig) return;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${ADMIN_HALL.vw} ${ADMIN_HALL.vh}`);

    // === Background ===
    svg.appendChild(svgEl('rect', {
        x: 0, y: 0, width: ADMIN_HALL.vw, height: ADMIN_HALL.vh, fill: '#0a0a0a',
    }));

    // === Hall frame (truss perimeter) ===
    const f = ADMIN_HALL.frame;
    svg.appendChild(svgEl('rect', {
        x: f.x, y: f.y, width: f.w, height: f.h,
        fill: 'none', stroke: '#4a4a4a', 'stroke-width': 3, rx: 4,
    }));
    svg.appendChild(svgEl('rect', {
        x: f.x + 5, y: f.y + 5, width: f.w - 10, height: f.h - 10,
        fill: 'none', stroke: '#3a3a3a', 'stroke-width': 1, rx: 2,
    }));

    // === Stage (trapezoid) ===
    const st = ADMIN_HALL.stage;
    const bv = st.bevel;
    const stagePath = `M ${st.x1} ${st.y1} L ${st.x2} ${st.y1} L ${st.x2} ${st.y2} L ${st.x2 - bv} ${st.y2} L ${st.x2 - bv - 10} ${st.y2 - 15} L ${st.x1 + bv + 10} ${st.y2 - 15} L ${st.x1 + bv} ${st.y2} L ${st.x1} ${st.y2} Z`;
    svg.appendChild(svgEl('path', {
        d: stagePath, fill: '#2a2a2a', stroke: '#555', 'stroke-width': 1,
    }));

    const stageLabel = svgEl('text', {
        x: (st.x1 + st.x2) / 2, y: (st.y1 + st.y2) / 2 + 5,
        'text-anchor': 'middle', fill: '#666', 'font-size': '24', 'font-weight': '600',
    });
    stageLabel.textContent = 'СЦЕНА';
    svg.appendChild(stageLabel);

    // === Lighting trusses ===
    svg.appendChild(svgEl('line', {
        x1: st.x1, y1: st.y2 - 20, x2: st.x1 - 50, y2: st.y2 + 40,
        stroke: '#555', 'stroke-width': 4,
    }));
    svg.appendChild(svgEl('line', {
        x1: st.x2, y1: st.y2 - 20, x2: st.x2 + 50, y2: st.y2 + 40,
        stroke: '#555', 'stroke-width': 4,
    }));

    // === Horizontal truss bar ===
    const tb = ADMIN_HALL.trussBar;
    svg.appendChild(svgEl('line', {
        x1: tb.x1, y1: tb.y, x2: tb.x2, y2: tb.y,
        stroke: '#4a4a4a', 'stroke-width': 3,
    }));
    svg.appendChild(svgEl('line', {
        x1: tb.x1, y1: tb.y + 10, x2: tb.x2, y2: tb.y + 10,
        stroke: '#3a3a3a', 'stroke-width': 2,
    }));
    for (let bx = tb.x1; bx < tb.x2; bx += 30) {
        svg.appendChild(svgEl('line', {
            x1: bx, y1: tb.y, x2: bx + 15, y2: tb.y + 10,
            stroke: '#3a3a3a', 'stroke-width': 0.5,
        }));
    }

    // === Speakers ===
    for (const sp of ADMIN_HALL.speakers) {
        svg.appendChild(svgEl('rect', {
            x: sp.x, y: sp.y, width: sp.w, height: sp.h,
            fill: '#111', stroke: '#333', 'stroke-width': 1,
        }));
    }

    // === Seats ===
    for (const sectorKey of ['left', 'center', 'right']) {
        const sec = ADMIN_HALL.sectors[sectorKey];
        const secW = adminSectorWidth(sectorKey);

        const lbl = svgEl('text', {
            x: sec.x + secW / 2, y: sec.y - 18,
            'text-anchor': 'middle', fill: '#94a3b8', 'font-size': '14', 'font-weight': '600',
        });
        const sectorLabel = adminHallConfig ? adminHallConfig[sectorKey].label : sectorKey;
        lbl.textContent = typeof t === 'function' ? t(sectorLabel) : sectorLabel;
        svg.appendChild(lbl);

        for (let rowIdx = 0; rowIdx < sec.rows; rowIdx++) {
            const rowNum = rowIdx + 1;
            const y = sec.y + rowIdx * (sec.seatH + sec.gapY);
            const seatsInRow = getAdminSeatsInRow(sectorKey, rowNum);



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
                });
                const title = svgEl('title', {});
                const tRow = typeof t === 'function' ? t('Ряд') : 'Ряд';
                const tSeat = typeof t === 'function' ? t('Место') : 'Место';
                if (seatData.is_reserved) {
                    title.textContent = `${typeof t === 'function' ? t('Занято') : 'Занято'} (зарез.) — ${tRow} ${seatData.row}, ${tSeat} ${seatData.number}`;
                } else if (seatData.is_occupied) {
                    title.textContent = `${seatData.guest_name} — ${tRow} ${seatData.row}, ${tSeat} ${seatData.number}`;
                } else {
                    title.textContent = `${typeof t === 'function' ? t('Свободно') : 'Свободно'} — ${tRow} ${seatData.row}, ${tSeat} ${seatData.number}`;
                }
                rect.appendChild(title);
                svg.appendChild(rect);
            }
        }
    }

    // === Control desk ===
    const cd = ADMIN_HALL.controlDesk;
    svg.appendChild(svgEl('rect', {
        x: cd.x, y: cd.y, width: cd.w, height: cd.h,
        fill: '#d1d5db', rx: 4, opacity: 0.9,
    }));
    const cb = ADMIN_HALL.controlBox;
    svg.appendChild(svgEl('rect', {
        x: cb.x, y: cb.y, width: cb.w, height: cb.h,
        fill: '#e5e7eb', rx: 3, opacity: 0.8,
    }));

    // === Gray squares ===
    for (const gs of ADMIN_HALL.graySquares) {
        svg.appendChild(svgEl('rect', {
            x: gs.x, y: gs.y, width: gs.w, height: gs.h,
            fill: '#6b7280', rx: 2, opacity: 0.6,
        }));
    }

    // === Entrances ===
    for (const ent of ADMIN_HALL.entrances) {
        svg.appendChild(svgEl('rect', {
            x: ent.x - 35, y: ent.y - 12,
            width: 70, height: 26,
            class: 'entrance-marker', rx: 6,
        }));
        const el = svgEl('text', {
            x: ent.x, y: ent.y + 5,
            'text-anchor': 'middle', fill: 'white', 'font-size': '12', 'font-weight': '700',
        });
        el.textContent = ent.label;
        svg.appendChild(el);
    }
}

// ================================================================
// Data loading
// ================================================================

async function loadAdminData() {
    try {
        // Load config first if not loaded
        if (!adminHallConfig) {
            const configResp = await fetch('/api/hall-config');
            adminHallConfig = await configResp.json();
        }

        const [seatsResp, guestsResp] = await Promise.all([
            fetch('/api/seats'),
            fetch('/admin/guests'),
        ]);

        adminSeats = await seatsResp.json();
        adminGuests = await guestsResp.json();

        renderAdminHall(adminSeats);
        renderGuestTable(adminGuests);
        populateSelects();
        updateAdminStats();
    } catch (err) {
        console.error('Failed to load admin data:', err);
    }
}

function updateAdminStats() {
    const el = document.getElementById('admin-occupied');
    if (el) {
        // Count only guest-occupied seats (not reserved)
        const occupied = adminSeats.filter(s => s.is_occupied && !s.is_reserved).length;
        el.textContent = occupied;
    }
}

// ================================================================
// Guest table
// ================================================================

function renderGuestTable(guests) {
    const tbody = document.getElementById('guest-table-body');
    if (!tbody) return;

    if (guests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">${typeof t === 'function' ? t('Нет назначенных гостей') : 'Нет назначенных гостей'}</td></tr>`;
        return;
    }

    tbody.innerHTML = guests.map(g => `
        <tr class="border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors guest-row" data-name="${g.name?.toLowerCase() || ''}">
            <td class="px-4 py-2.5 text-white font-medium">${g.name || '—'}</td>
            <td class="px-4 py-2.5 text-gray-300">${typeof t === 'function' ? t(g.sector_label || '') || '—' : (g.sector_label || '—')}</td>
            <td class="px-4 py-2.5 text-gray-300">${g.row ?? '—'}</td>
            <td class="px-4 py-2.5 text-gray-300">${g.number ?? '—'}</td>
            <td class="px-4 py-2.5">
                ${g.seat_id ? `<button onclick="removeSeatAssignment(${g.seat_id})" class="text-red-400 hover:text-red-300 text-xs transition-colors">${typeof t === 'function' ? t('Снять с места') : 'Снять с места'}</button>` : `<span class="text-gray-600 text-xs">${typeof t === 'function' ? t('Не назначен') : 'не назначен'}</span>`}
            </td>
        </tr>
    `).join('');
}

// ================================================================
// Move guest selects
// ================================================================

function populateSelects() {
    const sourceSelect = document.getElementById('move-source');
    const targetSelect = document.getElementById('move-target');
    const assignTargetSelect = document.getElementById('assign-target');
    if (!sourceSelect || !targetSelect) return;

    // Source: occupied seats (exclude reserved — they have no guest)
    const occupied = adminSeats.filter(s => s.is_occupied && !s.is_reserved);
    const tFrom = typeof t === 'function' ? t('Откуда (выберите гостя)') : 'Откуда (выберите гостя)';
    const tRow = typeof t === 'function' ? t('Ряд') : 'Ряд';
    const tSeat = typeof t === 'function' ? t('Место') : 'Место';
    
    sourceSelect.innerHTML = `<option value="">${tFrom}</option>` +
        occupied.map(s =>
            `<option value="${s.id}">${s.guest_name} — ${typeof t === 'function' ? t(s.sector_label) : s.sector_label}, ${tRow} ${s.row} ${tSeat} ${s.number}</option>`
        ).join('');

    // Target: all seats EXCEPT reserved
    const nonReserved = adminSeats.filter(s => !s.is_reserved);
    const tFree = typeof t === 'function' ? t('Свободно') : 'свободно';
    const targetOptions = nonReserved.map(s => {
            const secLabel = typeof t === 'function' ? t(s.sector_label) : s.sector_label;
            const label = s.is_occupied
                ? `${secLabel}, ${tRow} ${s.row} ${tSeat} ${s.number} (${s.guest_name})`
                : `${secLabel}, ${tRow} ${s.row} ${tSeat} ${s.number} (${tFree})`;
            return `<option value="${s.id}">${label}</option>`;
        }).join('');
    
    const tTo = typeof t === 'function' ? t('Куда (выберите место)') : 'Куда (выберите место)';
    targetSelect.innerHTML = `<option value="">${tTo}</option>` + targetOptions;
    if (assignTargetSelect) {
        const tSelectSeat = typeof t === 'function' ? t('Выберите место') : 'Выберите место';
        assignTargetSelect.innerHTML = `<option value="">${tSelectSeat}</option>` + targetOptions;
    }
}

// ================================================================
// Actions
// ================================================================

async function assignGuest() {
    const seatId = document.getElementById('assign-target').value;
    const name = document.getElementById('assign-name').value.trim();
    const category = document.getElementById('assign-category').value.trim();

    if (!seatId || !name) {
        showToast(typeof t === 'function' ? t('Выберите место и введите ФИО') : 'Выберите место и введите ФИО', 'error');
        return;
    }

    try {
        const resp = await fetch('/admin/assign-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seat_id: parseInt(seatId),
                action: 'assign',
                guest_name: name,
                guest_category: category
            }),
        });

        const data = await resp.json();
        if (data.success) {
            showToast(data.message, 'success');
            document.getElementById('assign-name').value = '';
            document.getElementById('assign-category').value = '';
            await loadAdminData();
        } else {
            showToast(data.detail || 'Ошибка', 'error');
        }
    } catch (err) {
        showToast('Ошибка сети', 'error');
    }
}

async function moveGuest() {
    const sourceId = document.getElementById('move-source').value;
    const targetId = document.getElementById('move-target').value;

    if (!sourceId || !targetId) {
        showToast('Выберите откуда и куда переместить гостя', 'error');
        return;
    }

    if (sourceId === targetId) {
        showToast('Нельзя переместить на то же место', 'error');
        return;
    }

    try {
        const resp = await fetch('/admin/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_seat_id: parseInt(sourceId),
                target_seat_id: parseInt(targetId),
            }),
        });

        const data = await resp.json();
        if (data.success) {
            showToast('Гость перемещён', 'success');
            await loadAdminData();
        } else {
            showToast(data.detail || 'Ошибка', 'error');
        }
    } catch (err) {
        showToast('Ошибка соединения', 'error');
    }
}

async function removeSeatAssignment(seatId) {
    try {
        const resp = await fetch('/admin/assign-single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seat_id: seatId, action: 'unassign' }),
        });

        const data = await resp.json();
        if (data.success) {
            showToast('Гость снят с места', 'success');
            await loadAdminData();
        }
    } catch (err) {
        showToast('Ошибка', 'error');
    }
}

async function clearAll() {
    const msg = typeof t === 'function' ? t('Вы уверены, что хотите очистить ВСЕ назначения?') : 'Вы уверены, что хотите очистить ВСЕ назначения?';
    if (!confirm(msg)) return;

    try {
        const resp = await fetch('/admin/clear', { method: 'POST' });
        const data = await resp.json();
        if (data.success) {
            showToast('Все назначения очищены', 'success');
            await loadAdminData();
        }
    } catch (err) {
        showToast('Ошибка', 'error');
    }
}

// ================================================================
// Excel Upload
// ================================================================

document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('file-input');
    const uploadForm = document.getElementById('upload-form');
    const uploadBtn = document.getElementById('upload-btn');
    const fileNameDisplay = document.getElementById('file-name');
    const dropZone = document.getElementById('drop-zone');
    const resultDiv = document.getElementById('upload-result');

    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                fileNameDisplay.textContent = this.files[0].name;
                fileNameDisplay.classList.remove('hidden');
                uploadBtn.disabled = false;
            }
        });
    }

    // Drag and drop
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                fileNameDisplay.textContent = e.dataTransfer.files[0].name;
                fileNameDisplay.classList.remove('hidden');
                uploadBtn.disabled = false;
            }
        });
    }

    // Upload form submit
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (!fileInput.files.length) {
                showToast('Выберите файл', 'error');
                return;
            }

            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Загрузка...';

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            try {
                const resp = await fetch('/admin/upload-seating', {
                    method: 'POST',
                    body: formData,
                });

                const data = await resp.json();

                if (data.success) {
                    resultDiv.classList.remove('hidden');
                    resultDiv.innerHTML = `
                        <div class="bg-green-900/50 border border-green-600 rounded-lg p-3 text-sm">
                            <p class="text-green-300 font-medium">${data.message}</p>
                            ${data.warning ? `<p class="text-yellow-300 mt-1">⚠ ${data.warning}</p>` : ''}
                        </div>
                    `;
                    showToast(data.message, 'success');
                    await loadAdminData();
                } else {
                    resultDiv.classList.remove('hidden');
                    resultDiv.innerHTML = `
                        <div class="bg-red-900/50 border border-red-600 rounded-lg p-3 text-sm">
                            <p class="text-red-300">${data.detail || 'Ошибка'}</p>
                        </div>
                    `;
                    showToast(data.detail || 'Ошибка загрузки', 'error');
                }
            } catch (err) {
                showToast('Ошибка соединения', 'error');
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Загрузить и распределить';
            }
        });
    }

    // Search filter
    const searchInput = document.getElementById('guest-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            document.querySelectorAll('.guest-row').forEach(row => {
                const name = row.getAttribute('data-name') || '';
                row.style.display = name.includes(query) ? '' : 'none';
            });
        });
    }

    // Initial load
    loadAdminData();

    // Re-render when language changes
    window.addEventListener('languageChanged', () => {
        if (adminSeats.length > 0) {
            renderAdminHall();
            renderGuestList();
            populateSelects();
        }
    });
});
