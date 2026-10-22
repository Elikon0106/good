/**
 * Digital Bridge — Navigation Hall Renderer
 * Renders a mini hall map with highlighted path from entrance to seat.
 * Uses hall config passed as parameter (from /api/hall-config).
 */

const NAV_HALL = {
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
    // Entrances
    entrances: [
        { id: 'A', label: 'Вход A', x: 470, y: 1210 },
        { id: 'Б', label: 'Вход Б', x: 830, y: 1210 },
    ],
};

function navGetSeatsInRow(sectorKey, row) {
    const s = NAV_HALL.sectors[sectorKey];
    if (sectorKey === 'center' && row === 1) return s.row1Seats;
    return s.seatsPerRow;
}

function navSectorWidth(sectorKey) {
    const s = NAV_HALL.sectors[sectorKey];
    return s.seatsPerRow * (s.seatW + s.gapX) - s.gapX;
}

function svgElNav(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
    return el;
}

function renderNavigationHall(svgId, hallConfig, targetSeat) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${NAV_HALL.vw} ${NAV_HALL.vh}`);

    // === Background ===
    svg.appendChild(svgElNav('rect', {
        x: 0, y: 0, width: NAV_HALL.vw, height: NAV_HALL.vh, fill: '#0a0a0a',
    }));

    // === Hall frame (truss perimeter) ===
    const f = NAV_HALL.frame;
    svg.appendChild(svgElNav('rect', {
        x: f.x, y: f.y, width: f.w, height: f.h,
        fill: 'none', stroke: '#4a4a4a', 'stroke-width': 3, rx: 4,
    }));
    svg.appendChild(svgElNav('rect', {
        x: f.x + 5, y: f.y + 5, width: f.w - 10, height: f.h - 10,
        fill: 'none', stroke: '#3a3a3a', 'stroke-width': 1, rx: 2,
    }));

    // === Stage ===
    const st = NAV_HALL.stage;
    const bv = st.bevel;
    const stagePath = `M ${st.x1} ${st.y1} L ${st.x2} ${st.y1} L ${st.x2} ${st.y2} L ${st.x2 - bv} ${st.y2} L ${st.x2 - bv - 10} ${st.y2 - 15} L ${st.x1 + bv + 10} ${st.y2 - 15} L ${st.x1 + bv} ${st.y2} L ${st.x1} ${st.y2} Z`;
    svg.appendChild(svgElNav('path', {
        d: stagePath, fill: '#2a2a2a', stroke: '#555', 'stroke-width': 1,
    }));

    const stageLabel = svgElNav('text', {
        x: (st.x1 + st.x2) / 2, y: (st.y1 + st.y2) / 2 + 5,
        'text-anchor': 'middle', fill: '#666', 'font-size': '24', 'font-weight': '600',
    });
    stageLabel.textContent = t('СЦЕНА');
    svg.appendChild(stageLabel);

    // === Lighting trusses ===
    svg.appendChild(svgElNav('line', {
        x1: st.x1, y1: st.y2 - 20, x2: st.x1 - 50, y2: st.y2 + 40,
        stroke: '#555', 'stroke-width': 4,
    }));
    svg.appendChild(svgElNav('line', {
        x1: st.x2, y1: st.y2 - 20, x2: st.x2 + 50, y2: st.y2 + 40,
        stroke: '#555', 'stroke-width': 4,
    }));

    // === Horizontal truss bar ===
    const tb = NAV_HALL.trussBar;
    svg.appendChild(svgElNav('line', {
        x1: tb.x1, y1: tb.y, x2: tb.x2, y2: tb.y,
        stroke: '#4a4a4a', 'stroke-width': 3,
    }));
    svg.appendChild(svgElNav('line', {
        x1: tb.x1, y1: tb.y + 10, x2: tb.x2, y2: tb.y + 10,
        stroke: '#3a3a3a', 'stroke-width': 2,
    }));
    for (let bx = tb.x1; bx < tb.x2; bx += 30) {
        svg.appendChild(svgElNav('line', {
            x1: bx, y1: tb.y, x2: bx + 15, y2: tb.y + 10,
            stroke: '#3a3a3a', 'stroke-width': 0.5,
        }));
    }

    // === Speakers ===
    for (const sp of NAV_HALL.speakers) {
        svg.appendChild(svgElNav('rect', {
            x: sp.x, y: sp.y, width: sp.w, height: sp.h,
            fill: '#111', stroke: '#333', 'stroke-width': 1,
        }));
    }

    let targetX = 0, targetY = 0;

    // === Seats ===
    for (const sectorKey of ['left', 'center', 'right']) {
        const sec = NAV_HALL.sectors[sectorKey];
        const secW = navSectorWidth(sectorKey);

        const lbl = svgElNav('text', {
            x: sec.x + secW / 2, y: sec.y - 18,
            'text-anchor': 'middle', fill: '#94a3b8', 'font-size': '14', 'font-weight': '600',
        });
        const sectorLabel = hallConfig ? hallConfig[sectorKey].label : sectorKey;
        lbl.textContent = t(sectorLabel);
        svg.appendChild(lbl);

        for (let rowIdx = 0; rowIdx < sec.rows; rowIdx++) {
            const rowNum = rowIdx + 1;
            const y = sec.y + rowIdx * (sec.seatH + sec.gapY);
            const seatsInRow = navGetSeatsInRow(sectorKey, rowNum);



            const rowW = seatsInRow * (sec.seatW + sec.gapX) - sec.gapX;
            const xOffset = (secW - rowW) / 2;

            for (let num = 0; num < seatsInRow; num++) {
                const x = sec.x + xOffset + num * (sec.seatW + sec.gapX);
                const isTarget = sectorKey === targetSeat.sector && rowNum === targetSeat.row && (num + 1) === targetSeat.number;
                if (isTarget) {
                    targetX = x + sec.seatW / 2;
                    targetY = y + sec.seatH / 2;
                }

                svg.appendChild(svgElNav('rect', {
                    x: x, y: y,
                    width: sec.seatW, height: sec.seatH,
                    fill: isTarget ? '#ef4444' : '#334155',
                    rx: 3,
                    opacity: isTarget ? 1 : 0.4,
                    class: isTarget ? 'seat-highlight' : '',
                }));
            }
        }
    }

    // === Entrances ===
    const entranceMap = { left: 'A', center: 'A', right: 'Б' };
    const myEntrance = entranceMap[targetSeat.sector];

    for (const ent of NAV_HALL.entrances) {
        const isMyEntrance = ent.id === myEntrance;
        svg.appendChild(svgElNav('rect', {
            x: ent.x - 35, y: ent.y - 12,
            width: 70, height: 26,
            fill: isMyEntrance ? '#ef4444' : '#f97316',
            rx: 6,
            opacity: isMyEntrance ? 1 : 0.4,
        }));
        const el = svgElNav('text', {
            x: ent.x, y: ent.y + 5,
            'text-anchor': 'middle', fill: 'white', 'font-size': '12', 'font-weight': '700',
        });
        el.textContent = typeof t === 'function' ? t(ent.label) : ent.label;
        svg.appendChild(el);
    }

    // Draw path
    if (targetX && targetY) {
        const ent = NAV_HALL.entrances.find(e => e.id === myEntrance);
        const sec = NAV_HALL.sectors[targetSeat.sector];
        const secW = navSectorWidth(targetSeat.sector);
        const sectorCenterX = sec.x + secW / 2;

        const pathPoints = [
            `${ent.x},${ent.y - 15}`,
            `${sectorCenterX},${ent.y - 40}`,
            `${sectorCenterX},${targetY + 15}`,
            `${targetX},${targetY + 15}`,
            `${targetX},${targetY}`,
        ];

        svg.appendChild(svgElNav('polyline', {
            points: pathPoints.join(' '),
            class: 'nav-path',
        }));

        svg.appendChild(svgElNav('circle', {
            cx: targetX, cy: targetY, r: 14,
            fill: 'none', stroke: '#ef4444', 'stroke-width': 2,
            opacity: 0.8, class: 'seat-highlight',
        }));
    }
}
