import jsPDF from 'jspdf';
import { ProjectState, WALL_TYPE_LABELS, WallSegment } from '@/lib/types';
import { getTotalWallLength } from '@/lib/wallCalculations';

// Engineering drawing colors
const COLORS = {
  border: [30, 30, 30] as [number, number, number],
  gridLight: [210, 210, 210] as [number, number, number],
  gridDark: [170, 170, 170] as [number, number, number],
  wall: [180, 40, 40] as [number, number, number],
  wallFill: [255, 200, 200] as [number, number, number],
  dimension: [40, 40, 180] as [number, number, number],
  text: [30, 30, 30] as [number, number, number],
  titleBlock: [45, 55, 72] as [number, number, number],
  ground: [140, 120, 80] as [number, number, number],
  concrete: [180, 180, 180] as [number, number, number],
  hatch: [100, 100, 100] as [number, number, number],
  green: [60, 140, 60] as [number, number, number],
};

interface BBox {
  minLng: number; maxLng: number;
  minLat: number; maxLat: number;
}

function getWallsBBox(walls: WallSegment[]): BBox {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  walls.forEach(w => w.points.forEach(p => {
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
  }));
  // Add 20% padding
  const padLng = Math.max((maxLng - minLng) * 0.3, 0.0003);
  const padLat = Math.max((maxLat - minLat) * 0.3, 0.0003);
  return {
    minLng: minLng - padLng, maxLng: maxLng + padLng,
    minLat: minLat - padLat, maxLat: maxLat + padLat,
  };
}

function lngLatToXY(
  lng: number, lat: number, bbox: BBox,
  drawArea: { x: number; y: number; w: number; h: number }
) {
  const xRatio = (lng - bbox.minLng) / (bbox.maxLng - bbox.minLng);
  const yRatio = (lat - bbox.minLat) / (bbox.maxLat - bbox.minLat);
  return {
    x: drawArea.x + xRatio * drawArea.w,
    y: drawArea.y + drawArea.h - yRatio * drawArea.h, // flip Y
  };
}

function drawBorder(doc: jsPDF, w: number, h: number) {
  // Outer border
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(1.0);
  doc.rect(8, 8, w - 16, h - 16);
  // Inner border
  doc.setLineWidth(0.3);
  doc.rect(12, 12, w - 24, h - 24);
}

function drawGrid(
  doc: jsPDF,
  drawArea: { x: number; y: number; w: number; h: number },
  bbox: BBox
) {
  // Calculate a nice grid spacing in metres
  const latSpanM = (bbox.maxLat - bbox.minLat) * 111320;
  const gridSpacingM = getGridSpacing(latSpanM);
  const latPerM = (bbox.maxLat - bbox.minLat) / latSpanM;
  const lngSpanM = (bbox.maxLng - bbox.minLng) * 111320 * Math.cos(((bbox.minLat + bbox.maxLat) / 2) * Math.PI / 180);
  const lngPerM = (bbox.maxLng - bbox.minLng) / lngSpanM;

  doc.setDrawColor(...COLORS.gridLight);
  doc.setLineWidth(0.15);

  // Horizontal grid lines
  for (let m = 0; m <= latSpanM; m += gridSpacingM) {
    const lat = bbox.minLat + m * latPerM;
    const { y } = lngLatToXY(bbox.minLng, lat, bbox, drawArea);
    if (y >= drawArea.y && y <= drawArea.y + drawArea.h) {
      doc.line(drawArea.x, y, drawArea.x + drawArea.w, y);
    }
  }

  // Vertical grid lines
  for (let m = 0; m <= lngSpanM; m += gridSpacingM) {
    const lng = bbox.minLng + m * lngPerM;
    const { x } = lngLatToXY(lng, bbox.minLat, bbox, drawArea);
    if (x >= drawArea.x && x <= drawArea.x + drawArea.w) {
      doc.line(x, drawArea.y, x, drawArea.y + drawArea.h);
    }
  }

  return gridSpacingM;
}

function getGridSpacing(spanM: number): number {
  const target = spanM / 6;
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500];
  return candidates.reduce((best, c) => Math.abs(c - target) < Math.abs(best - target) ? c : best);
}

function drawScaleBar(doc: jsPDF, x: number, y: number, scaleM: number, pixPerM: number) {
  const barLengthMM = scaleM * pixPerM;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.setFillColor(30, 30, 30);

  // Draw alternating blocks
  const segments = 4;
  const segLen = barLengthMM / segments;
  for (let i = 0; i < segments; i++) {
    if (i % 2 === 0) {
      doc.rect(x + i * segLen, y, segLen, 2.5, 'F');
    } else {
      doc.rect(x + i * segLen, y, segLen, 2.5, 'S');
    }
  }

  doc.setFontSize(6);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'normal');
  doc.text('0', x, y + 6);
  doc.text(`${scaleM}m`, x + barLengthMM - 2, y + 6);
  doc.text('SCALE BAR', x, y - 2);
}

function drawNorthArrow(doc: jsPDF, cx: number, cy: number) {
  doc.setFillColor(...COLORS.border);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);

  // Arrow shaft
  const len = 10;
  doc.line(cx, cy + len / 2, cx, cy - len / 2);
  // Arrowhead filled
  doc.triangle(cx, cy - len / 2, cx - 2.5, cy - len / 2 + 5, cx + 2.5, cy - len / 2 + 5, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.border);
  doc.text('N', cx - 1.5, cy - len / 2 - 3);
}

function drawTitleBlock(doc: jsPDF, w: number, h: number, project: ProjectState) {
  const tbH = 30;
  const tbY = h - 12 - tbH;
  const tbX = w - 12 - 120;
  const tbW = 120;

  doc.setFillColor(...COLORS.titleBlock);
  doc.rect(tbX, tbY, tbW, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('SIMPLE ENGINEERS', tbX + 3, tbY + 7);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Concept Planning Tool', tbX + 55, tbY + 7);

  // Info rows
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(6);

  const rows = [
    ['PROJECT:', project.details.address || 'N/A'],
    ['CLIENT:', project.details.clientName || 'N/A'],
    ['REF:', project.details.projectReference || 'N/A'],
    ['DATE:', new Date().toLocaleDateString('en-AU')],
  ];

  rows.forEach((row, i) => {
    const ry = tbY + 10 + i * 5;
    doc.rect(tbX, ry, tbW, 5);
    doc.setFont('helvetica', 'bold');
    doc.text(row[0], tbX + 2, ry + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.text(row[1], tbX + 22, ry + 3.5);
  });

  // Drawing title
  doc.setFontSize(5);
  doc.setFont('helvetica', 'italic');
  doc.text('CONCEPT RETAINING WALL SITE PLAN — NOT FOR CONSTRUCTION', tbX + 2, tbY + tbH + 4);
}

function drawWallsOnPlan(
  doc: jsPDF, walls: WallSegment[], bbox: BBox,
  drawArea: { x: number; y: number; w: number; h: number }
) {
  walls.forEach((wall, wallIdx) => {
    if (wall.points.length < 2) return;

    // Draw wall line (thick)
    doc.setDrawColor(...COLORS.wall);
    doc.setLineWidth(1.2);
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = lngLatToXY(wall.points[i].lng, wall.points[i].lat, bbox, drawArea);
      const p2 = lngLatToXY(wall.points[i + 1].lng, wall.points[i + 1].lat, bbox, drawArea);
      doc.line(p1.x, p1.y, p2.x, p2.y);
    }

    // Draw hatch marks on retained side (short perpendicular ticks)
    doc.setLineWidth(0.3);
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = lngLatToXY(wall.points[i].lng, wall.points[i].lat, bbox, drawArea);
      const p2 = lngLatToXY(wall.points[i + 1].lng, wall.points[i + 1].lat, bbox, drawArea);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;
      const nx = -dy / len;
      const ny = dx / len;
      const tickLen = 2.5;
      const numTicks = Math.max(2, Math.floor(len / 4));
      for (let t = 0; t <= numTicks; t++) {
        const frac = t / numTicks;
        const mx = p1.x + dx * frac;
        const my = p1.y + dy * frac;
        doc.line(mx, my, mx + nx * tickLen, my + ny * tickLen);
      }
    }

    // Draw nodes
    doc.setFillColor(...COLORS.wall);
    wall.points.forEach(p => {
      const { x, y } = lngLatToXY(p.lng, p.lat, bbox, drawArea);
      doc.circle(x, y, 1, 'F');
    });

    // Wall label
    const midIdx = Math.floor(wall.points.length / 2);
    const mp1 = wall.points[Math.max(0, midIdx - 1)];
    const mp2 = wall.points[Math.min(wall.points.length - 1, midIdx)];
    const labelPt = lngLatToXY(
      (mp1.lng + mp2.lng) / 2, (mp1.lat + mp2.lat) / 2, bbox, drawArea
    );

    // Label background
    doc.setFillColor(255, 255, 255);
    const labelText = `${wall.name}`;
    const lengthText = `${wall.length.toFixed(1)}m`;
    doc.rect(labelPt.x - 10, labelPt.y - 8, 22, 10, 'F');
    doc.setDrawColor(...COLORS.wall);
    doc.setLineWidth(0.2);
    doc.rect(labelPt.x - 10, labelPt.y - 8, 22, 10, 'S');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.wall);
    doc.text(labelText, labelPt.x - 8, labelPt.y - 3);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(lengthText, labelPt.x - 8, labelPt.y + 1);

    // Dimension lines
    drawDimensionLine(doc, wall, bbox, drawArea);
  });
}

function drawDimensionLine(
  doc: jsPDF, wall: WallSegment, bbox: BBox,
  drawArea: { x: number; y: number; w: number; h: number }
) {
  if (wall.points.length < 2) return;

  const first = wall.points[0];
  const last = wall.points[wall.points.length - 1];
  const p1 = lngLatToXY(first.lng, first.lat, bbox, drawArea);
  const p2 = lngLatToXY(last.lng, last.lat, bbox, drawArea);

  // Offset dimension line
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const nx = -dy / len * 6;
  const ny = dx / len * 6;

  doc.setDrawColor(...COLORS.dimension);
  doc.setLineWidth(0.2);

  // Extension lines
  doc.line(p1.x, p1.y, p1.x + nx, p1.y + ny);
  doc.line(p2.x, p2.y, p2.x + nx, p2.y + ny);

  // Dimension line
  doc.line(p1.x + nx, p1.y + ny, p2.x + nx, p2.y + ny);

  // Arrows
  const arrowSize = 1.5;
  const adx = dx / len * arrowSize;
  const ady = dy / len * arrowSize;
  // Arrow at p1 end
  doc.line(p1.x + nx, p1.y + ny, p1.x + nx + adx + ady * 0.5, p1.y + ny + ady - adx * 0.5);
  doc.line(p1.x + nx, p1.y + ny, p1.x + nx + adx - ady * 0.5, p1.y + ny + ady + adx * 0.5);
  // Arrow at p2 end
  doc.line(p2.x + nx, p2.y + ny, p2.x + nx - adx + ady * 0.5, p2.y + ny - ady - adx * 0.5);
  doc.line(p2.x + nx, p2.y + ny, p2.x + nx - adx - ady * 0.5, p2.y + ny - ady + adx * 0.5);

  // Dimension text
  const midX = (p1.x + p2.x) / 2 + nx;
  const midY = (p1.y + p2.y) / 2 + ny;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dimension);
  doc.text(`${wall.length.toFixed(1)}m`, midX - 4, midY - 1.5);
}

function drawWallElevation(
  doc: jsPDF, wall: WallSegment,
  x: number, y: number, availWidth: number, maxElevH: number
) {
  const wallLen = wall.length || 5;
  const wallH = wall.maxHeight || 1;

  // Scale to fit
  const hScale = availWidth / wallLen;
  const vScale = maxElevH / Math.max(wallH + 1.5, 3);
  const scale = Math.min(hScale, vScale);

  const drawnW = wallLen * scale;
  const drawnH = wallH * scale;
  const footingDepth = 0.5 * scale;

  // Ground line
  doc.setDrawColor(...COLORS.ground);
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([2, 1], 0);
  doc.line(x - 5, y, x + drawnW + 15, y);
  doc.setLineDashPattern([], 0);

  // Footing
  doc.setDrawColor(...COLORS.concrete);
  doc.setFillColor(230, 230, 230);
  doc.setLineWidth(0.3);
  const footingW = drawnW + 4;
  const footingX = x - 2;
  doc.rect(footingX, y, footingW, footingDepth + 2, 'FD');

  // Hatch footing
  doc.setDrawColor(...COLORS.hatch);
  doc.setLineWidth(0.1);
  for (let hx = footingX; hx < footingX + footingW; hx += 2) {
    doc.line(hx, y, Math.min(hx + footingDepth + 2, footingX + footingW), y + footingDepth + 2);
  }

  // Wall stem
  doc.setDrawColor(...COLORS.wall);
  doc.setFillColor(245, 245, 245);
  doc.setLineWidth(0.5);
  const stemW = Math.max(drawnW, 4);
  doc.rect(x, y - drawnH, stemW, drawnH, 'FD');

  // Wall hatch pattern (diagonal lines)
  doc.setLineWidth(0.1);
  doc.setDrawColor(...COLORS.hatch);
  for (let hy = y - drawnH; hy < y; hy += 3) {
    doc.line(x, hy, x + stemW, hy + 3);
  }

  // Retained soil triangle pattern (right side)
  doc.setDrawColor(...COLORS.ground);
  doc.setFillColor(220, 210, 190);
  doc.setLineWidth(0.3);
  const soilW = Math.min(15, availWidth - drawnW - 10);
  if (soilW > 3) {
    doc.triangle(
      x + stemW, y,
      x + stemW, y - drawnH,
      x + stemW + soilW, y,
      'FD'
    );
    // Soil dots
    doc.setFillColor(...COLORS.ground);
    for (let sy = y - drawnH + 3; sy < y - 1; sy += 4) {
      for (let sx = x + stemW + 2; sx < x + stemW + soilW - 1; sx += 4) {
        const relY = (sy - (y - drawnH)) / drawnH;
        if (sx < x + stemW + soilW * relY) {
          doc.circle(sx, sy, 0.3, 'F');
        }
      }
    }
  }

  // Height dimension (left side)
  doc.setDrawColor(...COLORS.dimension);
  doc.setLineWidth(0.2);
  const dimX = x - 8;
  doc.line(dimX, y, dimX, y - drawnH);
  doc.line(dimX - 1, y, dimX + 1, y);
  doc.line(dimX - 1, y - drawnH, dimX + 1, y - drawnH);
  // Arrows
  doc.line(dimX, y, dimX - 0.8, y - 1.5);
  doc.line(dimX, y, dimX + 0.8, y - 1.5);
  doc.line(dimX, y - drawnH, dimX - 0.8, y - drawnH + 1.5);
  doc.line(dimX, y - drawnH, dimX + 0.8, y - drawnH + 1.5);

  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dimension);
  doc.text(`${wallH.toFixed(1)}m`, dimX - 6, y - drawnH / 2 + 1, { angle: 90 });

  // Length dimension (bottom)
  const dimY = y + footingDepth + 6;
  doc.setDrawColor(...COLORS.dimension);
  doc.line(x, dimY, x + stemW, dimY);
  doc.line(x, dimY - 1, x, dimY + 1);
  doc.line(x + stemW, dimY - 1, x + stemW, dimY + 1);
  doc.text(`${wallLen.toFixed(1)}m`, x + stemW / 2 - 3, dimY + 3.5);

  // Labels
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.text);
  doc.text(`${wall.name} — ELEVATION`, x, y - drawnH - 5);
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Type: ${WALL_TYPE_LABELS[wall.wallType]}`, x, y - drawnH - 1.5);

  // Annotations
  const annotX = x + stemW + soilW + 5;
  doc.setFontSize(5);
  doc.setTextColor(...COLORS.text);
  const notes = [
    `Max Height: ${wall.maxHeight}m`,
    `Avg Height: ${wall.averageHeight}m`,
    wall.hasSurcharge ? 'Surcharge: YES' : '',
    wall.hasFenceAbove ? 'Fence Above: YES' : '',
    wall.hasDrainageRequired ? 'Drainage: REQ' : '',
  ].filter(Boolean);
  notes.forEach((n, i) => {
    doc.text(n, annotX, y - drawnH + 2 + i * 3.5);
  });

  // Fence above indicator
  if (wall.hasFenceAbove) {
    doc.setDrawColor(...COLORS.text);
    doc.setLineWidth(0.3);
    const fenceH = 4;
    // Posts
    for (let fx = x; fx <= x + stemW; fx += Math.max(stemW / 3, 5)) {
      doc.line(fx, y - drawnH, fx, y - drawnH - fenceH);
    }
    // Top rail
    doc.line(x, y - drawnH - fenceH, x + stemW, y - drawnH - fenceH);
    doc.line(x, y - drawnH - fenceH / 2, x + stemW, y - drawnH - fenceH / 2);
  }

  return drawnH + footingDepth + 15; // return total height used
}

function drawWallScheduleTable(doc: jsPDF, walls: WallSegment[], x: number, y: number, maxW: number) {
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.text);
  doc.text('WALL SCHEDULE', x, y);
  y += 4;

  const colWidths = [18, 45, 16, 14, 14, 12, 12, 12];
  const headers = ['REF', 'TYPE', 'LEN(m)', 'AVG H', 'MAX H', 'SRCH', 'FENCE', 'DRAIN'];
  const totalW = Math.min(colWidths.reduce((a, b) => a + b, 0), maxW);

  // Header row
  doc.setFillColor(45, 55, 72);
  doc.rect(x, y, totalW, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  let cx = x;
  headers.forEach((h, i) => {
    doc.text(h, cx + 1, y + 3.5);
    cx += colWidths[i];
  });
  y += 5;

  // Data rows
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'normal');
  walls.forEach((wall, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(x, y, totalW, 4.5, 'F');
    }
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.rect(x, y, totalW, 4.5);

    cx = x;
    const vals = [
      wall.name,
      WALL_TYPE_LABELS[wall.wallType].substring(0, 25),
      wall.length.toFixed(1),
      wall.averageHeight.toString(),
      wall.maxHeight.toString(),
      wall.hasSurcharge ? 'Y' : 'N',
      wall.hasFenceAbove ? 'Y' : 'N',
      wall.hasDrainageRequired ? 'Y' : 'N',
    ];
    vals.forEach((v, i) => {
      doc.text(v, cx + 1, y + 3.2);
      cx += colWidths[i];
    });
    y += 4.5;
  });

  // Total row
  doc.setFillColor(240, 240, 240);
  doc.rect(x, y, totalW, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text(`TOTAL LENGTH: ${getTotalWallLength(walls).toFixed(1)}m`, x + 2, y + 3.5);
  doc.text(`${walls.length} SEGMENT(S)`, x + 60, y + 3.5);
}

export function generateEngineeringSitePlan(project: ProjectState) {
  const doc = new jsPDF('landscape', 'mm', 'a3');
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // ─── PAGE 1: SITE PLAN ───────────────────────────────
  drawBorder(doc, w, h);

  // Drawing title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.text);
  doc.text('CONCEPT RETAINING WALL — SITE PLAN', 18, 20);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('PRELIMINARY CONCEPT ONLY — NOT FOR CONSTRUCTION — ENGINEERING CERTIFICATION REQUIRED', 18, 25);

  if (project.walls.length > 0 && project.walls.some(wall => wall.points.length >= 2)) {
    const bbox = getWallsBBox(project.walls);

    // Plan drawing area
    const planArea = { x: 25, y: 32, w: w * 0.55, h: h - 80 };

    // Draw plan border
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.rect(planArea.x, planArea.y, planArea.w, planArea.h);

    // Grid
    const gridSpacing = drawGrid(doc, planArea, bbox);

    // Walls
    drawWallsOnPlan(doc, project.walls, bbox, planArea);

    // Scale bar
    const latSpanM = (bbox.maxLat - bbox.minLat) * 111320;
    const pixPerM = planArea.h / latSpanM;
    drawScaleBar(doc, planArea.x + 5, planArea.y + planArea.h - 10, gridSpacing, pixPerM);

    // North arrow
    drawNorthArrow(doc, planArea.x + planArea.w - 12, planArea.y + 15);

    // Grid reference text
    doc.setFontSize(4.5);
    doc.setTextColor(...COLORS.gridDark);
    doc.text(`Grid: ${gridSpacing}m`, planArea.x + 5, planArea.y + planArea.h - 2);

    // Wall schedule (right side of plan page)
    const schedX = planArea.x + planArea.w + 15;
    drawWallScheduleTable(doc, project.walls, schedX, 35, w - schedX - 15);

    // Notes section
    let notesY = 35 + project.walls.length * 4.5 + 25;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.text);
    doc.text('NOTES', schedX, notesY);
    notesY += 5;
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    const notes = [
      '1. All dimensions are approximate.',
      '2. Measurements from map data — verify by survey.',
      '3. Wall positions are conceptual.',
      '4. Heights are as nominated by user.',
      '5. Offsets are user-estimated.',
      '6. Engineering design required before construction.',
      '7. Not for council submission.',
    ];
    notes.forEach(n => {
      doc.text(n, schedX, notesY);
      notesY += 3.5;
    });

    // Site context notes
    if (project.siteContext.slopeNotes || project.siteContext.comments) {
      notesY += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text('SITE CONTEXT', schedX, notesY);
      notesY += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      if (project.siteContext.slopeNotes) { doc.text(`Slope: ${project.siteContext.slopeNotes}`, schedX, notesY); notesY += 3.5; }
      if (project.siteContext.accessNotes) { doc.text(`Access: ${project.siteContext.accessNotes}`, schedX, notesY); notesY += 3.5; }
      if (project.siteContext.adjoiningStructures) { doc.text(`Adjoining: ${project.siteContext.adjoiningStructures}`, schedX, notesY); notesY += 3.5; }
      if (project.siteContext.comments) { doc.text(`Comments: ${project.siteContext.comments}`, schedX, notesY); notesY += 3.5; }
    }
  } else {
    // No walls drawn
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('No wall segments drawn — plan view unavailable', w / 2 - 50, h / 2);
  }

  // Title block
  drawTitleBlock(doc, w, h, project);

  // Disclaimer bar at bottom
  doc.setFillColor(250, 250, 250);
  doc.rect(12, h - 18, w - 24 - 125, 6, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.2);
  doc.rect(12, h - 18, w - 24 - 125, 6, 'S');
  doc.setFontSize(4.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'DISCLAIMER: This is a preliminary concept planning document only. Not for construction or council approval. Engineering certification required. © Simple Engineers',
    15, h - 14
  );

  // ─── PAGE 2: WALL ELEVATIONS ───────────────────────────
  if (project.walls.length > 0) {
    doc.addPage([420, 297], 'landscape');
    drawBorder(doc, w, h);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.text);
    doc.text('CONCEPT RETAINING WALL — ELEVATIONS & SECTIONS', 18, 20);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('PRELIMINARY CONCEPT ONLY — NOT FOR CONSTRUCTION — ENGINEERING CERTIFICATION REQUIRED', 18, 25);

    // Draw each wall elevation
    const maxElevsPerPage = 3;
    let elevY = 45;
    const elevAvailW = w - 60;
    const elevMaxH = (h - 90) / Math.min(project.walls.length, maxElevsPerPage);

    project.walls.forEach((wall, idx) => {
      if (idx > 0 && idx % maxElevsPerPage === 0) {
        doc.addPage('a3', 'landscape');
        drawBorder(doc, w, h);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.text);
        doc.text('CONCEPT RETAINING WALL — ELEVATIONS & SECTIONS (CONT.)', 18, 20);
        elevY = 45;
      }

      // Separator line
      if (idx % maxElevsPerPage > 0) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);
        doc.setLineDashPattern([3, 2], 0);
        doc.line(18, elevY - 8, w - 18, elevY - 8);
        doc.setLineDashPattern([], 0);
      }

      const usedH = drawWallElevation(doc, wall, 35, elevY + Math.min(elevMaxH * 0.6, 45), elevAvailW * 0.6, Math.min(elevMaxH * 0.5, 35));
      elevY += Math.max(usedH, elevMaxH) + 5;
    });

    drawTitleBlock(doc, w, h, project);

    // Disclaimer
    doc.setFillColor(250, 250, 250);
    doc.rect(12, h - 18, w - 24 - 125, 6, 'F');
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    doc.rect(12, h - 18, w - 24 - 125, 6, 'S');
    doc.setFontSize(4.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      'DISCLAIMER: This is a preliminary concept planning document only. Not for construction or council approval. Engineering certification required. © Simple Engineers',
      15, h - 14
    );
  }

  doc.save(`concept-site-plan-${project.details.projectReference || 'export'}.pdf`);
}
