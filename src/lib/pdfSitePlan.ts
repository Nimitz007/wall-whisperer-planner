import jsPDF from 'jspdf';
import { ProjectState, WALL_TYPE_LABELS, WallSegment, WallType } from '@/lib/types';
import { getTotalWallLength, calculateDistance } from '@/lib/wallCalculations';
import { BrandingConfig, brandingToRGB } from '@/lib/branding';

// ─── COLOUR PALETTE ────────────────────────────────────────
type RGB = [number, number, number];
const C = {
  border:     [30, 30, 30]      as RGB,
  gridLight:  [200, 200, 200]   as RGB,
  wall:       [190, 30, 30]     as RGB,
  dimension:  [20, 60, 180]     as RGB,
  text:       [25, 25, 25]      as RGB,
  textLight:  [100, 100, 100]   as RGB,
  titleBg:    [35, 45, 62]      as RGB,
  soil:       [165, 140, 95]    as RGB,
  soilFill:   [225, 215, 190]   as RGB,
  concrete:   [190, 190, 190]   as RGB,
  concFill:   [230, 230, 230]   as RGB,
  sleeper:    [160, 130, 90]    as RGB,
  sleeperFill:[210, 190, 155]   as RGB,
  timber:     [140, 100, 55]    as RGB,
  timberFill: [200, 175, 135]   as RGB,
  masonry:    [150, 150, 150]   as RGB,
  masonryFill:[215, 215, 215]   as RGB,
  gabion:     [130, 130, 130]   as RGB,
  gabionFill: [200, 200, 200]   as RGB,
  green:      [60, 130, 60]     as RGB,
  fence:      [70, 70, 70]      as RGB,
  drainage:   [60, 120, 180]    as RGB,
  white:      [255, 255, 255]   as RGB,
};

// ─── GEOMETRY HELPERS ──────────────────────────────────────
interface BBox { minLng: number; maxLng: number; minLat: number; maxLat: number; }
interface DrawArea { x: number; y: number; w: number; h: number; }

function getWallsBBox(walls: WallSegment[]): BBox {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  walls.forEach(w => w.points.forEach(p => {
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
  }));
  const padLng = Math.max((maxLng - minLng) * 0.35, 0.0004);
  const padLat = Math.max((maxLat - minLat) * 0.35, 0.0004);
  return { minLng: minLng - padLng, maxLng: maxLng + padLng, minLat: minLat - padLat, maxLat: maxLat + padLat };
}

function toXY(lng: number, lat: number, bbox: BBox, a: DrawArea) {
  return {
    x: a.x + ((lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * a.w,
    y: a.y + a.h - ((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * a.h,
  };
}

function niceGrid(spanM: number): number {
  const t = spanM / 6;
  return [1, 2, 5, 10, 20, 50, 100, 200, 500].reduce((b, c) => Math.abs(c - t) < Math.abs(b - t) ? c : b);
}

// ─── SATELLITE UNDERLAY ────────────────────────────────────
async function fetchSatelliteImage(bbox: BBox, widthPx: number, heightPx: number, token: string): Promise<string | null> {
  try {
    const cLng = (bbox.minLng + bbox.maxLng) / 2;
    const cLat = (bbox.minLat + bbox.maxLat) / 2;
    // Calculate zoom from bbox
    const latSpan = bbox.maxLat - bbox.minLat;
    const zoom = Math.min(Math.floor(Math.log2(180 / latSpan)) + 1, 19);
    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${cLng},${cLat},${zoom},0/${widthPx}x${heightPx}@2x?access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ─── DRAWING PRIMITIVES ───────────────────────────────────

function drawBorder(doc: jsPDF, w: number, h: number) {
  doc.setDrawColor(...C.border); doc.setLineWidth(1.0);
  doc.rect(8, 8, w - 16, h - 16);
  doc.setLineWidth(0.3);
  doc.rect(12, 12, w - 24, h - 24);
}

function drawGrid(doc: jsPDF, a: DrawArea, bbox: BBox) {
  const latSpanM = (bbox.maxLat - bbox.minLat) * 111320;
  const gs = niceGrid(latSpanM);
  const latPerM = (bbox.maxLat - bbox.minLat) / latSpanM;
  const lngSpanM = (bbox.maxLng - bbox.minLng) * 111320 * Math.cos(((bbox.minLat + bbox.maxLat) / 2) * Math.PI / 180);
  const lngPerM = (bbox.maxLng - bbox.minLng) / lngSpanM;
  doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.12);
  doc.saveGraphicsState(); doc.setGState(new (doc as any).GState({ opacity: 0.35 }));
  for (let m = 0; m <= latSpanM; m += gs) {
    const { y } = toXY(bbox.minLng, bbox.minLat + m * latPerM, bbox, a);
    if (y >= a.y && y <= a.y + a.h) doc.line(a.x, y, a.x + a.w, y);
  }
  for (let m = 0; m <= lngSpanM; m += gs) {
    const { x } = toXY(bbox.minLng + m * lngPerM, bbox.minLat, bbox, a);
    if (x >= a.x && x <= a.x + a.w) doc.line(x, a.y, x, a.y + a.h);
  }
  doc.restoreGraphicsState();
  return gs;
}

function drawScaleBar(doc: jsPDF, x: number, y: number, scaleM: number, pixPerM: number) {
  const barLen = scaleM * pixPerM;
  const segs = 4, segL = barLen / segs;
  doc.setFillColor(255, 255, 255);
  doc.rect(x - 2, y - 4, barLen + 4, 12, 'F');
  doc.setDrawColor(...C.border); doc.setLineWidth(0.4);
  for (let i = 0; i < segs; i++) {
    if (i % 2 === 0) { doc.setFillColor(30, 30, 30); doc.rect(x + i * segL, y, segL, 2, 'F'); }
    else { doc.rect(x + i * segL, y, segL, 2, 'S'); }
  }
  doc.setFontSize(5); doc.setTextColor(...C.text); doc.setFont('helvetica', 'normal');
  doc.text('0', x, y + 5); doc.text(`${scaleM}m`, x + barLen - 3, y + 5);
  doc.setFontSize(4.5); doc.text('SCALE', x, y - 1);
}

function drawNorthArrow(doc: jsPDF, cx: number, cy: number) {
  // White background circle
  doc.setFillColor(255, 255, 255); doc.circle(cx, cy, 8, 'F');
  doc.setDrawColor(...C.border); doc.setLineWidth(0.3); doc.circle(cx, cy, 8, 'S');
  // Arrow
  doc.setFillColor(...C.border);
  doc.triangle(cx, cy - 6, cx - 2.5, cy + 1, cx + 2.5, cy + 1, 'F');
  doc.setFillColor(255, 255, 255);
  doc.triangle(cx, cy + 6, cx - 2.5, cy + 1, cx + 2.5, cy + 1, 'F');
  doc.setDrawColor(...C.border);
  doc.triangle(cx, cy + 6, cx - 2.5, cy + 1, cx + 2.5, cy + 1, 'S');
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.border);
  doc.text('N', cx - 1.8, cy - 9);
}

function drawTitleBlock(doc: jsPDF, w: number, h: number, project: ProjectState, branding: BrandingConfig | undefined, sheetTitle: string) {
  const companyName = branding?.companyName ?? 'Wall Planner';
  const tbW = 125, tbH = 32;
  const tbX = w - 12 - tbW, tbY = h - 12 - tbH;
  // Header bar
  doc.setFillColor(...C.titleBg); doc.rect(tbX, tbY, tbW, 8, 'F');
  doc.setTextColor(...C.white); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), tbX + 3, tbY + 5.5);
  doc.setFontSize(5); doc.setFont('helvetica', 'normal');
  doc.text('Concept Planning Tool', tbX + 52, tbY + 5.5);
  // Info grid
  doc.setDrawColor(...C.border); doc.setLineWidth(0.25);
  doc.setTextColor(...C.text); doc.setFontSize(5);
  const rows: [string, string][] = [
    ['PROJECT', project.details.address || 'N/A'],
    ['CLIENT', project.details.clientName || 'N/A'],
    ['REF', project.details.projectReference || 'N/A'],
    ['DATE', new Date().toLocaleDateString('en-AU')],
    ['SHEET', sheetTitle],
  ];
  rows.forEach(([label, val], i) => {
    const ry = tbY + 8 + i * 4.8;
    doc.rect(tbX, ry, 20, 4.8); doc.rect(tbX + 20, ry, tbW - 20, 4.8);
    doc.setFont('helvetica', 'bold'); doc.text(label, tbX + 1.5, ry + 3.3);
    doc.setFont('helvetica', 'normal'); doc.text(val, tbX + 22, ry + 3.3);
  });
  doc.setFontSize(4); doc.setFont('helvetica', 'italic'); doc.setTextColor(...C.textLight);
  doc.text('CONCEPT ONLY — NOT FOR CONSTRUCTION', tbX + 2, tbY + tbH + 3);
}

function drawDisclaimer(doc: jsPDF, w: number, h: number, branding?: BrandingConfig) {
  const companyName = branding?.companyName ?? 'Wall Planner';
  const barW = w - 24 - 130;
  doc.setFillColor(250, 250, 250); doc.rect(12, h - 17, barW, 5, 'F');
  doc.setDrawColor(...C.border); doc.setLineWidth(0.15); doc.rect(12, h - 17, barW, 5, 'S');
  doc.setFontSize(4); doc.setTextColor(...C.textLight);
  doc.text(`DISCLAIMER: Preliminary concept only. Not for construction or council approval. Engineering certification required. \u00A9 ${companyName}`, 14, h - 13.5);
}

// ─── PLAN VIEW: NODE-TO-NODE DIMENSIONS ───────────────────
function drawSegmentDimension(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, lengthM: number, offset: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 3) return;
  const nx = (-dy / len) * offset, ny = (dx / len) * offset;
  doc.setDrawColor(...C.dimension); doc.setLineWidth(0.15);
  // Extension lines
  doc.line(x1, y1, x1 + nx, y1 + ny);
  doc.line(x2, y2, x2 + nx, y2 + ny);
  // Dim line
  doc.line(x1 + nx, y1 + ny, x2 + nx, y2 + ny);
  // Ticks
  const tdx = dx / len * 1, tdy = dy / len * 1;
  doc.line(x1 + nx - tdy * 0.6, y1 + ny + tdx * 0.6, x1 + nx + tdy * 0.6, y1 + ny - tdx * 0.6);
  doc.line(x2 + nx - tdy * 0.6, y2 + ny + tdx * 0.6, x2 + nx + tdy * 0.6, y2 + ny - tdx * 0.6);
  // Text
  const mx = (x1 + x2) / 2 + nx, my = (y1 + y2) / 2 + ny;
  doc.setFillColor(255, 255, 255); doc.rect(mx - 5, my - 2.5, 10, 3.5, 'F');
  doc.setFontSize(4.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.dimension);
  doc.text(`${lengthM.toFixed(1)}m`, mx - 4, my);
}

function drawWallsOnPlan(doc: jsPDF, walls: WallSegment[], bbox: BBox, a: DrawArea) {
  walls.forEach(wall => {
    if (wall.points.length < 2) return;
    // Thick wall line
    doc.setDrawColor(...C.wall); doc.setLineWidth(1.4);
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = toXY(wall.points[i].lng, wall.points[i].lat, bbox, a);
      const p2 = toXY(wall.points[i + 1].lng, wall.points[i + 1].lat, bbox, a);
      doc.line(p1.x, p1.y, p2.x, p2.y);
    }
    // Hatch ticks on retained side
    doc.setLineWidth(0.25);
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = toXY(wall.points[i].lng, wall.points[i].lat, bbox, a);
      const p2 = toXY(wall.points[i + 1].lng, wall.points[i + 1].lat, bbox, a);
      const dx = p2.x - p1.x, dy = p2.y - p1.y, l = Math.sqrt(dx * dx + dy * dy);
      if (l < 1) continue;
      const nx = -dy / l, ny = dx / l;
      const n = Math.max(2, Math.floor(l / 3.5));
      for (let t = 0; t <= n; t++) {
        const f = t / n;
        doc.line(p1.x + dx * f, p1.y + dy * f, p1.x + dx * f + nx * 2.2, p1.y + dy * f + ny * 2.2);
      }
    }
    // Nodes with labels
    doc.setFillColor(...C.wall);
    wall.points.forEach((p, i) => {
      const { x, y } = toXY(p.lng, p.lat, bbox, a);
      doc.circle(x, y, 1.2, 'F');
      // Node label
      doc.setFillColor(255, 255, 255); doc.setDrawColor(...C.wall); doc.setLineWidth(0.15);
      doc.rect(x + 2, y - 3, 5, 3.5, 'FD');
      doc.setFontSize(4); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.wall);
      doc.text(`${i + 1}`, x + 3, y - 0.5);
      doc.setFillColor(...C.wall);
    });
    // Node-to-node dimension lines
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = toXY(wall.points[i].lng, wall.points[i].lat, bbox, a);
      const p2 = toXY(wall.points[i + 1].lng, wall.points[i + 1].lat, bbox, a);
      const segLen = calculateDistance(wall.points[i], wall.points[i + 1]);
      drawSegmentDimension(doc, p1.x, p1.y, p2.x, p2.y, segLen, 6);
    }
    // Wall label at midpoint
    const mi = Math.floor(wall.points.length / 2);
    const mp1 = wall.points[Math.max(0, mi - 1)], mp2 = wall.points[Math.min(wall.points.length - 1, mi)];
    const lp = toXY((mp1.lng + mp2.lng) / 2, (mp1.lat + mp2.lat) / 2, bbox, a);
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...C.wall); doc.setLineWidth(0.2);
    doc.rect(lp.x - 12, lp.y - 10, 26, 11, 'FD');
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.wall);
    doc.text(wall.name, lp.x - 10, lp.y - 4.5);
    doc.setFontSize(5); doc.setFont('helvetica', 'normal');
    doc.text(`${wall.length.toFixed(1)}m total`, lp.x - 10, lp.y - 0.5);
  });
}

// ─── WALL SCHEDULE TABLE ──────────────────────────────────
function drawWallSchedule(doc: jsPDF, walls: WallSegment[], x: number, y: number, maxW?: number) {
  doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text);
  doc.text('WALL SCHEDULE', x, y); y += 4;
  const cols = [17, 55, 14, 13, 13, 10, 10, 10];
  const hdrs = ['REF', 'TYPE', 'LEN', 'AVG H', 'MAX H', 'SRCH', 'FNCE', 'DRN'];
  const tw = Math.min(cols.reduce((a, b) => a + b, 0), maxW || 999);
  doc.setFillColor(...C.titleBg); doc.rect(x, y, tw, 4.5, 'F');
  doc.setTextColor(...C.white); doc.setFontSize(4.5); doc.setFont('helvetica', 'bold');
  let cx = x; hdrs.forEach((h, i) => { doc.text(h, cx + 1, y + 3.2); cx += cols[i]; }); y += 4.5;
  doc.setTextColor(...C.text); doc.setFont('helvetica', 'normal');
  walls.forEach((wall, idx) => {
    if (idx % 2 === 0) { doc.setFillColor(245, 245, 245); doc.rect(x, y, tw, 4, 'F'); }
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.08); doc.rect(x, y, tw, 4);
    cx = x;
    [wall.name, WALL_TYPE_LABELS[wall.wallType], wall.length.toFixed(1),
     wall.averageHeight.toString(), wall.maxHeight.toString(),
     wall.hasSurcharge ? 'Y' : 'N', wall.hasFenceAbove ? 'Y' : 'N', wall.hasDrainageRequired ? 'Y' : 'N'
    ].forEach((v, i) => { doc.text(v, cx + 1, y + 2.8); cx += cols[i]; });
    y += 4;
  });
  doc.setFillColor(235, 235, 235); doc.rect(x, y, tw, 4.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(4.5);
  doc.text(`TOTAL: ${getTotalWallLength(walls).toFixed(1)}m  |  ${walls.length} SEGMENT(S)`, x + 2, y + 3);
  return y + 8;
}

// ─── ELEVATION DRAWING (wall-type specific) ───────────────

function getWallColors(type: WallType): { stroke: RGB; fill: RGB } {
  switch (type) {
    case 'concrete-sleeper': return { stroke: C.sleeper, fill: C.sleeperFill };
    case 'timber': return { stroke: C.timber, fill: C.timberFill };
    case 'reinforced-masonry': return { stroke: C.masonry, fill: C.masonryFill };
    case 'reinforced-concrete': return { stroke: C.concrete, fill: C.concFill };
    case 'gabion': return { stroke: C.gabion, fill: C.gabionFill };
    default: return { stroke: C.concrete, fill: C.concFill };
  }
}

function drawElevation(doc: jsPDF, wall: WallSegment, ox: number, baseY: number, availW: number, availH: number): number {
  const wallLen = wall.length || 3;
  const wallH = wall.maxHeight || 1;
  const totalVisH = wallH + 1.0; // include footing
  // Use separate horizontal and vertical scales for clarity
  const hScale = Math.min((availW * 0.55) / wallLen, 25);
  const vScale = Math.min((availH * 0.45) / totalVisH, 60);
  const wW = wallLen * hScale;
  const wH = wallH * vScale;
  const footH = Math.min(0.4 * vScale, 8);
  const wallColors = getWallColors(wall.wallType);
  const groundY = baseY;

  // ── Title ──
  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text);
  doc.text(`${wall.name} — TYPICAL ELEVATION`, ox, groundY - wH - 12);
  doc.setFontSize(5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.textLight);
  doc.text(`Type: ${WALL_TYPE_LABELS[wall.wallType]}  |  Length: ${wallLen.toFixed(1)}m  |  Max Ht: ${wallH.toFixed(1)}m`, ox, groundY - wH - 8);

  // ── Extended ground line ──
  const gExtL = 15, gExtR = 25;
  doc.setDrawColor(...C.soil); doc.setLineWidth(0.6);
  doc.line(ox - gExtL, groundY, ox + wW + gExtR, groundY);
  // Ground hatch below
  doc.setLineWidth(0.15);
  for (let gx = ox - gExtL; gx < ox + wW + gExtR; gx += 3) {
    doc.line(gx, groundY, gx - 2, groundY + 2);
  }

  // ── Footing ──
  const fW = wW + 6, fX = ox - 3;
  doc.setFillColor(...C.concFill); doc.setDrawColor(...C.concrete); doc.setLineWidth(0.35);
  doc.rect(fX, groundY, fW, footH, 'FD');
  // Concrete hatch in footing
  doc.setDrawColor(170, 170, 170); doc.setLineWidth(0.08);
  for (let hx = fX + 1; hx < fX + fW; hx += 2.5) {
    doc.line(hx, groundY, Math.min(hx + footH, fX + fW), groundY + footH);
  }

  // ── Wall stem (type-specific rendering) ──
  doc.setFillColor(...wallColors.fill); doc.setDrawColor(...wallColors.stroke); doc.setLineWidth(0.4);

  const stemThickness = Math.max(wW, 5); // visual width for elevation view

  switch (wall.wallType) {
    case 'concrete-sleeper': {
      // Draw individual 200mm sleeper courses
      const numCourses = Math.max(1, Math.round(wallH / 0.2));
      const actualCourseH = wH / numCourses;
      for (let c = 0; c < numCourses; c++) {
        const cy = groundY - (c + 1) * actualCourseH;
        doc.setFillColor(...wallColors.fill);
        doc.rect(ox, cy, stemThickness, actualCourseH, 'FD');
        // Sleeper texture: horizontal line in centre
        doc.setDrawColor(...wallColors.stroke); doc.setLineWidth(0.1);
        doc.line(ox + 0.5, cy + actualCourseH * 0.5, ox + stemThickness - 0.5, cy + actualCourseH * 0.5);
      }
      // Steel H-posts at intervals
      const postSpacing = Math.max(stemThickness / Math.ceil(wallLen / 2.4), 8);
      doc.setFillColor(100, 100, 100);
      for (let px = ox; px <= ox + stemThickness; px += postSpacing) {
        doc.rect(px - 0.8, groundY - wH, 1.6, wH + footH, 'F');
      }
      break;
    }
    case 'reinforced-masonry': {
      // Draw block courses (200mm blocks)
      const numCourses = Math.max(1, Math.round(wallH / 0.2));
      const actualCourseH = wH / numCourses;
      const blockW = Math.max(0.4 * hScale, 4);
      for (let c = 0; c < numCourses; c++) {
        const cy = groundY - (c + 1) * actualCourseH;
        const offsetX = (c % 2) * blockW * 0.5; // stagger
        for (let bx = ox + offsetX; bx < ox + stemThickness; bx += blockW) {
          const bw = Math.min(blockW, ox + stemThickness - bx);
          doc.setFillColor(...wallColors.fill);
          doc.rect(bx, cy, bw, actualCourseH, 'FD');
        }
      }
      // Rebar indicators
      doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.2);
      doc.setLineDashPattern([1, 1.5], 0);
      for (let rx = ox + blockW; rx < ox + stemThickness; rx += blockW * 2) {
        doc.line(rx, groundY, rx, groundY - wH);
      }
      doc.setLineDashPattern([], 0);
      break;
    }
    case 'reinforced-concrete': {
      // Solid stem
      doc.rect(ox, groundY - wH, stemThickness, wH, 'FD');
      // Cross-hatch for concrete
      doc.setDrawColor(170, 170, 170); doc.setLineWidth(0.08);
      const hatchStep = Math.max(wH / 12, 2.5);
      for (let hy = groundY - wH; hy < groundY; hy += hatchStep) {
        doc.line(ox, hy, ox + stemThickness, hy + hatchStep);
      }
      for (let hy = groundY - wH; hy < groundY; hy += hatchStep) {
        doc.line(ox + stemThickness, hy, ox, hy + hatchStep);
      }
      // Rebar dots
      doc.setFillColor(60, 60, 60);
      const rebarY = [groundY - wH + 2, groundY - 2];
      rebarY.forEach(ry => {
        doc.circle(ox + 1.5, ry, 0.6, 'F');
        doc.circle(ox + stemThickness - 1.5, ry, 0.6, 'F');
      });
      break;
    }
    case 'timber': {
      // Horizontal timber rails
      const numRails = Math.max(1, Math.round(wallH / 0.2));
      const actualRailH = wH / numRails;
      for (let r = 0; r < numRails; r++) {
        const ry = groundY - (r + 1) * actualRailH;
        doc.setFillColor(...wallColors.fill);
        doc.rect(ox, ry, stemThickness, actualRailH, 'FD');
        // Wood grain lines
        doc.setDrawColor(...wallColors.stroke); doc.setLineWidth(0.06);
        doc.line(ox + 1, ry + actualRailH * 0.3, ox + stemThickness - 1, ry + actualRailH * 0.3);
        doc.line(ox + 2, ry + actualRailH * 0.7, ox + stemThickness - 2, ry + actualRailH * 0.7);
      }
      // Timber posts
      const postSpacing = Math.max(stemThickness / Math.ceil(wallLen / 1.8), 7);
      doc.setFillColor(120, 85, 45);
      for (let px = ox; px <= ox + stemThickness; px += postSpacing) {
        doc.rect(px - 1, groundY - wH, 2, wH + footH * 0.8, 'F');
      }
      break;
    }
    case 'gabion': {
      // Gabion baskets stacked
      const numRows = Math.max(1, Math.round(wallH / 1.0));
      const actualBH = wH / numRows;
      for (let r = 0; r < numRows; r++) {
        const ry = groundY - (r + 1) * actualBH;
        doc.setFillColor(...wallColors.fill);
        doc.rect(ox, ry, stemThickness, actualBH, 'FD');
        // Wire mesh pattern
        doc.setDrawColor(...wallColors.stroke); doc.setLineWidth(0.1);
        const meshSpacing = Math.max(actualBH / 3, 1.5);
        for (let my = ry; my < ry + actualBH; my += meshSpacing) {
          doc.line(ox, my, ox + stemThickness, my);
        }
        for (let mx = ox; mx < ox + stemThickness; mx += meshSpacing) {
          doc.line(mx, ry, mx, ry + actualBH);
        }
        // Stone fill circles
        doc.setFillColor(160, 160, 160);
        const stoneStep = Math.max(actualBH / 5, 3);
        for (let sy = ry + 1.5; sy < ry + actualBH - 1; sy += stoneStep) {
          for (let sx = ox + 2; sx < ox + stemThickness - 1; sx += stoneStep * 1.2) {
            const r2 = 0.5 + Math.random() * 0.5;
            doc.circle(sx, sy, r2, 'FD');
          }
        }
      }
      break;
    }
    default: {
      doc.rect(ox, groundY - wH, stemThickness, wH, 'FD');
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.08);
      for (let hy = groundY - wH + 2; hy < groundY; hy += 3) {
        doc.line(ox, hy, ox + stemThickness, hy + 3);
      }
      break;
    }
  }

  // ── Retained soil (right side) ──
  const soilW = Math.min(30, availW * 0.15);
  doc.setFillColor(...C.soilFill); doc.setDrawColor(...C.soil); doc.setLineWidth(0.3);
  // Soil profile as rectangle behind wall going up
  doc.rect(ox + stemThickness, groundY - wH, soilW, wH, 'FD');
  // Sloped top surface
  doc.setFillColor(...C.soilFill);
  const slopeRun = Math.min(15, wH * 0.8);
  doc.triangle(ox + stemThickness + soilW, groundY - wH, ox + stemThickness + soilW, groundY, ox + stemThickness + soilW + slopeRun, groundY, 'FD');
  // Soil dot pattern
  doc.setFillColor(...C.soil);
  const dotStep = Math.max(wH / 12, 3);
  for (let sy = groundY - wH + 2; sy < groundY - 1; sy += dotStep) {
    for (let sx = ox + stemThickness + 2; sx < ox + stemThickness + soilW - 1; sx += dotStep) {
      doc.circle(sx, sy, 0.25, 'F');
    }
  }

  // ── Finished ground level (left/low side) ──
  doc.setFillColor(200, 220, 200);
  doc.rect(ox - gExtL, groundY, gExtL - 1, 3, 'F');
  doc.setFontSize(3.5); doc.setTextColor(...C.green);
  doc.text('FGL', ox - gExtL + 1, groundY + 2);

  // ── Drainage (if required) ──
  if (wall.hasDrainageRequired) {
    const drainX = ox + stemThickness - 2;
    const drainY = groundY - 3;
    doc.setDrawColor(...C.drainage); doc.setLineWidth(0.3);
    doc.circle(drainX, drainY, 1.5, 'S');
    doc.setFillColor(...C.drainage);
    doc.circle(drainX, drainY, 0.4, 'F');
    // Ag pipe label
    doc.setFontSize(3.5); doc.setTextColor(...C.drainage);
    doc.text('100Ø AG PIPE', drainX + 3, drainY + 0.5);
    // Drainage aggregate zone
    doc.setDrawColor(...C.drainage); doc.setLineWidth(0.1);
    doc.setLineDashPattern([0.5, 0.5], 0);
    doc.rect(ox + stemThickness - 4, groundY - wH, 4, wH);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(3); doc.text('DRAIN.', ox + stemThickness - 3.5, groundY - wH - 1);
    doc.text('AGG.', ox + stemThickness - 3.5, groundY - wH + 2);
  }

  // ── Fence (only if hasFenceAbove) ──
  if (wall.hasFenceAbove) {
    const fenceH = Math.min(wH * 0.4, 12);
    doc.setDrawColor(...C.fence); doc.setLineWidth(0.35);
    // Posts
    const numPosts = Math.max(2, Math.ceil(stemThickness / 12));
    const postSpacing = stemThickness / (numPosts - 1);
    for (let i = 0; i < numPosts; i++) {
      const fx = ox + i * postSpacing;
      doc.line(fx, groundY - wH, fx, groundY - wH - fenceH);
    }
    // Rails
    doc.setLineWidth(0.25);
    doc.line(ox, groundY - wH - fenceH, ox + stemThickness, groundY - wH - fenceH);
    doc.line(ox, groundY - wH - fenceH * 0.5, ox + stemThickness, groundY - wH - fenceH * 0.5);
    // Fence label
    doc.setFontSize(4); doc.setTextColor(...C.fence); doc.setFont('helvetica', 'normal');
    doc.text('FENCE ABOVE', ox + stemThickness + 3, groundY - wH - fenceH + 2);
  }

  // ── HEIGHT DIMENSION (left side) ──
  const dimX = ox - 12;
  doc.setDrawColor(...C.dimension); doc.setLineWidth(0.2);
  doc.line(dimX, groundY, dimX, groundY - wH);
  // Extension lines
  doc.line(dimX - 1, groundY, ox - 1, groundY);
  doc.line(dimX - 1, groundY - wH, ox - 1, groundY - wH);
  // Ticks
  doc.line(dimX - 1, groundY, dimX + 1, groundY);
  doc.line(dimX - 1, groundY - wH, dimX + 1, groundY - wH);
  // Arrowheads
  doc.setFillColor(...C.dimension);
  doc.triangle(dimX, groundY, dimX - 0.6, groundY - 1.2, dimX + 0.6, groundY - 1.2, 'F');
  doc.triangle(dimX, groundY - wH, dimX - 0.6, groundY - wH + 1.2, dimX + 0.6, groundY - wH + 1.2, 'F');
  // Height text
  doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.dimension);
  const htText = `${wallH.toFixed(1)}m`;
  doc.text(htText, dimX - 3, groundY - wH / 2 + 1, { angle: 90 });

  // ── LENGTH DIMENSION (bottom) ──
  const ldY = groundY + footH + 5;
  doc.setDrawColor(...C.dimension); doc.setLineWidth(0.2);
  doc.line(ox, ldY, ox + stemThickness, ldY);
  doc.line(ox, groundY + footH, ox, ldY + 1);
  doc.line(ox + stemThickness, groundY + footH, ox + stemThickness, ldY + 1);
  doc.setFillColor(...C.dimension);
  doc.triangle(ox, ldY, ox + 1.2, ldY - 0.6, ox + 1.2, ldY + 0.6, 'F');
  doc.triangle(ox + stemThickness, ldY, ox + stemThickness - 1.2, ldY - 0.6, ox + stemThickness - 1.2, ldY + 0.6, 'F');
  doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.dimension);
  doc.text(`${wallLen.toFixed(1)}m`, ox + stemThickness / 2 - 4, ldY + 3.5);

  // ── Annotations panel ──
  const annX = ox + stemThickness + soilW + 15;
  doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text);
  doc.text('DETAILS', annX, groundY - wH);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(4.5);
  let annY = groundY - wH + 4;
  const details = [
    `Wall Type: ${WALL_TYPE_LABELS[wall.wallType]}`,
    `Max Height: ${wall.maxHeight}m`,
    `Avg Height: ${wall.averageHeight}m`,
    `Length: ${wallLen.toFixed(1)}m`,
    `Surcharge: ${wall.hasSurcharge ? 'YES' : 'NO'}`,
    `Fence Above: ${wall.hasFenceAbove ? 'YES' : 'NO'}`,
    `Drainage: ${wall.hasDrainageRequired ? 'YES' : 'NO'}`,
  ];
  details.forEach(d => { doc.text(d, annX, annY); annY += 3.5; });
  if (wall.notes) { doc.text(`Notes: ${wall.notes}`, annX, annY); annY += 3.5; }

  // ── Vertical exaggeration note ──
  if (Math.abs(vScale / hScale - 1) > 0.3) {
    const exagg = (vScale / hScale).toFixed(1);
    doc.setFontSize(4); doc.setFont('helvetica', 'italic'); doc.setTextColor(...C.textLight);
    doc.text(`Note: Vertical exaggeration ${exagg}x for clarity`, ox, groundY + footH + 12);
  }

  const fenceExtra = wall.hasFenceAbove ? Math.min(wH * 0.4, 12) + 4 : 0;
  return wH + footH + fenceExtra + 30;
}

// ─── MAIN EXPORT FUNCTION ─────────────────────────────────
export async function generateEngineeringSitePlan(project: ProjectState, mapboxToken?: string, branding?: BrandingConfig) {
  const doc = new jsPDF('landscape', 'mm', 'a3');
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // ═══ PAGE 1: SITE PLAN ═══════════════════════════════════
  drawBorder(doc, w, h);
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text);
  doc.text('CONCEPT RETAINING WALL — SITE PLAN', 18, 20);
  doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.textLight);
  doc.text('PRELIMINARY CONCEPT ONLY — NOT FOR CONSTRUCTION — ENGINEERING CERTIFICATION REQUIRED', 18, 24);

  if (project.walls.length > 0 && project.walls.some(wall => wall.points.length >= 2)) {
    const bbox = getWallsBBox(project.walls);
    const planArea: DrawArea = { x: 25, y: 30, w: w * 0.55, h: h - 78 };

    // Satellite underlay
    if (mapboxToken) {
      try {
        const imgData = await fetchSatelliteImage(bbox, 1280, 1024, mapboxToken);
        if (imgData) {
          doc.addImage(imgData, 'PNG', planArea.x, planArea.y, planArea.w, planArea.h);
          // Semi-transparent overlay for readability
          doc.saveGraphicsState();
          doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
          doc.setFillColor(255, 255, 255);
          doc.rect(planArea.x, planArea.y, planArea.w, planArea.h, 'F');
          doc.restoreGraphicsState();
        }
      } catch { /* proceed without satellite */ }
    }

    // Plan border
    doc.setDrawColor(...C.border); doc.setLineWidth(0.3);
    doc.rect(planArea.x, planArea.y, planArea.w, planArea.h);

    // Grid overlay
    const gridSpacing = drawGrid(doc, planArea, bbox);

    // Walls with node-to-node dimensions
    drawWallsOnPlan(doc, project.walls, bbox, planArea);

    // Scale bar & north arrow
    const latSpanM = (bbox.maxLat - bbox.minLat) * 111320;
    const pixPerM = planArea.h / latSpanM;
    drawScaleBar(doc, planArea.x + 5, planArea.y + planArea.h - 8, gridSpacing, pixPerM);
    drawNorthArrow(doc, planArea.x + planArea.w - 12, planArea.y + 14);
    doc.setFontSize(4); doc.setTextColor(...C.textLight); doc.text(`Grid: ${gridSpacing}m`, planArea.x + 5, planArea.y + planArea.h - 1);

    // Wall schedule (right side)
    const schedX = planArea.x + planArea.w + 15;
    let notesY = drawWallSchedule(doc, project.walls, schedX, 33);

    // Notes
    doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text);
    doc.text('NOTES', schedX, notesY); notesY += 4;
    doc.setFontSize(4.5); doc.setFont('helvetica', 'normal');
    ['1. All dimensions approximate.', '2. Verify by survey.', '3. Wall positions conceptual.',
     '4. Heights as nominated by user.', '5. Engineering design required.', '6. Not for council submission.'
    ].forEach(n => { doc.text(n, schedX, notesY); notesY += 3.2; });

    if (project.siteContext.slopeNotes || project.siteContext.comments) {
      notesY += 4;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5);
      doc.text('SITE CONTEXT', schedX, notesY); notesY += 3.5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(4.5);
      if (project.siteContext.slopeNotes) { doc.text(`Slope: ${project.siteContext.slopeNotes}`, schedX, notesY); notesY += 3.2; }
      if (project.siteContext.accessNotes) { doc.text(`Access: ${project.siteContext.accessNotes}`, schedX, notesY); notesY += 3.2; }
      if (project.siteContext.adjoiningStructures) { doc.text(`Adjoining: ${project.siteContext.adjoiningStructures}`, schedX, notesY); notesY += 3.2; }
      if (project.siteContext.comments) { doc.text(`Comments: ${project.siteContext.comments}`, schedX, notesY); notesY += 3.2; }
    }
  } else {
    doc.setFontSize(11); doc.setFont('helvetica', 'italic'); doc.setTextColor(160, 160, 160);
    doc.text('No wall segments drawn — plan view unavailable', w / 2 - 55, h / 2);
  }

  const totalSheets = 1 + project.walls.length;
  drawTitleBlock(doc, w, h, project, branding, `SITE PLAN — 1 of ${totalSheets}`);
  drawDisclaimer(doc, w, h, branding);

  // ═══ PAGE 2+: WALL ELEVATIONS ════════════════════════════
  if (project.walls.length > 0) {
    doc.addPage([420, 297], 'landscape');
    drawBorder(doc, w, h);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text);
    doc.text('CONCEPT RETAINING WALL — ELEVATIONS', 18, 20);
    doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.textLight);
    doc.text('PRELIMINARY CONCEPT ONLY — NOT FOR CONSTRUCTION — ENGINEERING CERTIFICATION REQUIRED', 18, 24);

    // One wall per page for better use of space
    const elevAvailW = w - 80;
    const elevAvailH = h - 100;

    project.walls.forEach((wall, idx) => {
      if (idx > 0) {
        drawTitleBlock(doc, w, h, project, branding, `ELEVATIONS — ${idx + 1} of ${project.walls.length + 1}`);
        drawDisclaimer(doc, w, h, branding);
        doc.addPage([420, 297], 'landscape');
        drawBorder(doc, w, h);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.text);
        doc.text('CONCEPT RETAINING WALL — ELEVATIONS', 18, 20);
        doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.textLight);
        doc.text('PRELIMINARY CONCEPT ONLY — NOT FOR CONSTRUCTION — ENGINEERING CERTIFICATION REQUIRED', 18, 24);
      }

      // Center the elevation vertically on the page
      const baseY = 55 + elevAvailH * 0.5;
      drawElevation(doc, wall, 50, baseY, elevAvailW, elevAvailH);
    });

    drawTitleBlock(doc, w, h, project, branding, `ELEVATIONS — ${totalSheets} of ${totalSheets}`);
    drawDisclaimer(doc, w, h, branding);
  }

  doc.save(`concept-site-plan-${project.details.projectReference || 'export'}.pdf`);
}
