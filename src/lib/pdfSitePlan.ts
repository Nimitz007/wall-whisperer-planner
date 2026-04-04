import jsPDF from 'jspdf';
import { ProjectState, WallSegment } from '@/lib/types';
import { calculateDistance } from '@/lib/wallCalculations';
import { BrandingConfig } from '@/lib/branding';

// ─── COLOUR PALETTE ────────────────────────────────────────
type RGB = [number, number, number];
const C = {
  black:      [0, 0, 0]          as RGB,
  border:     [0, 0, 0]          as RGB,
  text:       [0, 0, 0]          as RGB,
  white:      [255, 255, 255]    as RGB,
};

// ─── CONSTANTS ─────────────────────────────────────────────
const A3_W = 420; // mm
const A3_H = 297; // mm
const BORDER_OUTER = 5;
const BORDER_INNER = 7;
const TB_WIDTH = 85; // narrower title block
const FONT = 'helvetica';

// ─── GEOMETRY HELPERS ──────────────────────────────────────
interface BBox { minLng: number; maxLng: number; minLat: number; maxLat: number; }
interface DrawArea { x: number; y: number; w: number; h: number; }

function get1to200BBox(walls: WallSegment[], area: DrawArea): BBox {
  const realW = area.w * 0.2;
  const realH = area.h * 0.2;
  let cLng = 0, cLat = 0, n = 0;
  walls.forEach(w => w.points.forEach(p => { cLng += p.lng; cLat += p.lat; n++; }));
  if (n === 0) return { minLng: 0, maxLng: 1, minLat: 0, maxLat: 1 };
  cLng /= n; cLat /= n;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(cLat * Math.PI / 180);
  const halfLatSpan = (realH / 2) / mPerDegLat;
  const halfLngSpan = (realW / 2) / mPerDegLng;
  return {
    minLng: cLng - halfLngSpan, maxLng: cLng + halfLngSpan,
    minLat: cLat - halfLatSpan, maxLat: cLat + halfLatSpan,
  };
}

function toXY(lng: number, lat: number, bbox: BBox, a: DrawArea) {
  return {
    x: a.x + ((lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * a.w,
    y: a.y + a.h - ((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * a.h,
  };
}

// ─── SATELLITE UNDERLAY ────────────────────────────────────
async function fetchSatelliteImage(bbox: BBox, widthPx: number, heightPx: number, token: string): Promise<string | null> {
  try {
    const cLng = (bbox.minLng + bbox.maxLng) / 2;
    const cLat = (bbox.minLat + bbox.maxLat) / 2;
    const latSpan = bbox.maxLat - bbox.minLat;
    const zoom = Math.min(Math.floor(Math.log2(180 / latSpan)) + 1, 21);
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${cLat},${cLng}&zoom=${zoom}&size=${widthPx}x${heightPx}&scale=2&maptype=hybrid&style=feature:all|element:labels|visibility:off&key=${token}`;
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

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/images/ob-logo.jpg');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ─── WATERMARK ─────────────────────────────────────────────
function drawWatermark(doc: jsPDF) {
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
  doc.setFontSize(72);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('SIMPLE ENGINEERS', A3_W / 2, A3_H / 2, { align: 'center', angle: 35 });
  doc.restoreGraphicsState();
}

// ─── DRAWING PRIMITIVES ───────────────────────────────────

function drawBorder(doc: jsPDF) {
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.5);
  doc.rect(BORDER_INNER, BORDER_INNER, A3_W - BORDER_INNER * 2, A3_H - BORDER_INNER * 2);
}

function drawTitleBlock(
  doc: jsPDF,
  project: ProjectState,
  _branding: BrandingConfig | undefined,
  logoDataUrl: string | null,
  opts: { drawingTitle: string; scale: string; sheetNum: number; totalSheets: number; drawingNo: string; }
) {
  const tbX = A3_W - BORDER_INNER - TB_WIDTH;
  const tbTop = BORDER_INNER;
  const tbBottom = A3_H - BORDER_INNER;

  // Vertical separator
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.5);
  doc.line(tbX, tbTop, tbX, tbBottom);

  const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: '2-digit' });
  let cy = tbTop;

  // ── Revision table (compact) ──
  const revRowH = 3;
  for (let i = 0; i < 4; i++) {
    doc.setLineWidth(0.15);
    doc.line(tbX, cy + revRowH, tbX + TB_WIDTH, cy + revRowH);
    cy += revRowH;
  }
  // Label row
  const labelY = cy;
  doc.setLineWidth(0.3);
  doc.line(tbX, labelY, tbX + TB_WIDTH, labelY);

  const dateColW = 20;
  const descColW = TB_WIDTH - dateColW - 12;
  doc.setLineWidth(0.15);
  doc.line(tbX + dateColW, tbTop, tbX + dateColW, labelY);
  doc.line(tbX + dateColW + descColW, tbTop, tbX + dateColW + descColW, labelY);

  doc.setFontSize(4); doc.setFont(FONT, 'bold'); doc.setTextColor(...C.text);
  doc.text('DATE', tbX + dateColW / 2, labelY - 1, { align: 'center' });
  doc.text('DESCRIPTION', tbX + dateColW + descColW / 2, labelY - 1, { align: 'center' });
  doc.text('REV', tbX + dateColW + descColW + 6, labelY - 1, { align: 'center' });

  // First rev entry
  doc.setFont(FONT, 'normal'); doc.setFontSize(4);
  doc.text(dateStr, tbX + dateColW / 2, tbTop + 2.5, { align: 'center' });
  doc.text('PRELIMINARY ISSUE', tbX + dateColW + descColW / 2, tbTop + 2.5, { align: 'center' });
  doc.text('0', tbX + dateColW + descColW + 6, tbTop + 2.5, { align: 'center' });

  cy = labelY;

  // ── Logo area (compact) ──
  const logoAreaH = 32;
  if (logoDataUrl) {
    try {
      const logoW = 35; const logoH = 25;
      doc.addImage(logoDataUrl, 'JPEG', tbX + (TB_WIDTH - logoW) / 2, cy + 2, logoW, logoH);
    } catch { /* skip */ }
  }
  doc.setFontSize(5); doc.setFont(FONT, 'normal');
  doc.text('CIVIL AND STRUCTURAL', tbX + TB_WIDTH / 2, cy + logoAreaH - 2, { align: 'center' });
  cy += logoAreaH;
  doc.setLineWidth(0.2);
  doc.line(tbX, cy, tbX + TB_WIDTH, cy);

  // ── Company details ──
  cy += 3;
  doc.setFontSize(4.5); doc.setFont(FONT, 'normal');
  const info = ['ABN: 69 661 191 304', '1A Tarton Road,', 'Holden Hill SA, 5088', 'Telephone: 0480 632 951', 'www.obengineering.com.au'];
  info.forEach(l => { doc.text(l, tbX + 3, cy); cy += 2.8; });
  cy += 1;
  doc.setLineWidth(0.3); doc.line(tbX, cy, tbX + TB_WIDTH, cy);

  // ── Project name ──
  cy += 2.5;
  doc.setFontSize(4); doc.setFont(FONT, 'normal');
  doc.text('PROJECT NAME', tbX + 3, cy); cy += 3;
  doc.setFontSize(7); doc.setFont(FONT, 'bold');
  doc.text('PROPOSED RETAINING', tbX + 3, cy); cy += 3.5;
  doc.text('WALL', tbX + 3, cy); cy += 3.5;
  doc.setFontSize(5.5);
  const addr = project.details.address || 'N/A';
  const lines = doc.splitTextToSize(addr.toUpperCase(), TB_WIDTH - 6);
  lines.forEach((line: string) => { doc.text(line, tbX + 3, cy); cy += 3; });
  cy += 1;
  doc.line(tbX, cy, tbX + TB_WIDTH, cy);

  // ── Client ──
  cy += 2;
  doc.setFontSize(4); doc.setFont(FONT, 'normal');
  doc.text('CLIENT', tbX + 3, cy); cy += 3;
  doc.setFontSize(6); doc.setFont(FONT, 'bold');
  doc.text((project.details.clientName || 'N/A').toUpperCase(), tbX + 3, cy);
  cy += 4;
  doc.line(tbX, cy, tbX + TB_WIDTH, cy);

  // ── Drawing title ──
  cy += 2;
  doc.setFontSize(4); doc.setFont(FONT, 'normal');
  doc.text('DRAWING TITLE', tbX + 3, cy); cy += 3.5;
  doc.setFontSize(7); doc.setFont(FONT, 'bold');
  doc.text(opts.drawingTitle.toUpperCase(), tbX + 3, cy);
  cy += 4;
  doc.setLineWidth(0.2); doc.line(tbX, cy, tbX + TB_WIDTH, cy);

  // ── Designed / Drawn grid ──
  cy += 1;
  const gridH = 5.5;
  const halfW = TB_WIDTH / 2;
  doc.setLineWidth(0.15);
  doc.rect(tbX, cy, halfW, gridH); doc.rect(tbX + halfW, cy, halfW, gridH);
  doc.setFontSize(4); doc.setFont(FONT, 'normal');
  doc.text('DESIGNED', tbX + 2, cy + 2.5); doc.setFont(FONT, 'bold'); doc.text('S.A', tbX + 18, cy + 2.5);
  doc.text('DATE', tbX + halfW + 2, cy + 2.5); doc.text(dateStr, tbX + halfW + 14, cy + 2.5);
  cy += gridH;
  doc.rect(tbX, cy, halfW, gridH); doc.rect(tbX + halfW, cy, halfW, gridH);
  doc.setFont(FONT, 'normal');
  doc.text('DRAWN', tbX + 2, cy + 2.5); doc.setFont(FONT, 'bold'); doc.text('S.A', tbX + 18, cy + 2.5);
  doc.text('SCALE', tbX + halfW + 2, cy + 2.5); doc.text(opts.scale, tbX + halfW + 14, cy + 2.5);
  cy += gridH;

  // ── Drawing status ──
  doc.setFontSize(4); doc.setFont(FONT, 'normal');
  doc.text('DRAWING STATUS:', tbX + 3, cy + 2.5); cy += 4;
  doc.setFontSize(7); doc.setFont(FONT, 'bold');
  doc.text('PRELIMINARY ISSUE', tbX + 3, cy + 2); cy += 5;
  doc.setLineWidth(0.3); doc.line(tbX, cy, tbX + TB_WIDTH, cy);

  // ── Drawing number (tight, closes the block) ──
  cy += 2;
  doc.setFontSize(4); doc.setFont(FONT, 'normal');
  doc.text('DRAWING No:', tbX + 3, cy);
  doc.text('REV', tbX + TB_WIDTH - 12, cy); cy += 3.5;
  doc.setFontSize(10); doc.setFont(FONT, 'bold');
  doc.text(opts.drawingNo, tbX + 3, cy);
  doc.text('0', tbX + TB_WIDTH - 7, cy);
  cy += 3;

  // Close bottom of drawing number box
  doc.setLineWidth(0.3); doc.line(tbX, cy, tbX + TB_WIDTH, cy);

  // Fill remaining space below with a simple border
  if (cy < tbBottom) {
    doc.setLineWidth(0.1);
    doc.rect(tbX, cy, TB_WIDTH, tbBottom - cy);
  }

  // ── Vertical scale text ──
  doc.setFontSize(4.5); doc.setFont(FONT, 'normal');
  doc.text(`SCALE ${opts.scale} @ A3`, tbX - 2, tbBottom - 10, { angle: 90 });

  // ── Copyright ──
  doc.setFontSize(3.5);
  const year = new Date().getFullYear();
  doc.text(`© Copyright ${year}. OB ENGINEERING GROUP Pty. Ltd.`, BORDER_INNER + 2, tbBottom - 5, { angle: 90 });
}

// ─── NORTH ARROW ──────────────────────────────────────────
function drawNorthArrow(doc: jsPDF, cx: number, cy: number) {
  const size = 12;
  doc.setFillColor(...C.black); doc.setDrawColor(...C.black); doc.setLineWidth(0.3);
  doc.triangle(cx, cy - size, cx - 4, cy + 2, cx, cy - 2, 'F');
  doc.triangle(cx, cy - size, cx + 4, cy + 2, cx, cy - 2, 'S');
  doc.setFontSize(10); doc.setFont(FONT, 'bold'); doc.setTextColor(...C.black);
  doc.text('N', cx - 3, cy - size - 3);
}

// ─── LEGEND ───────────────────────────────────────────────
function drawLegend(doc: jsPDF, x: number, y: number) {
  doc.setFontSize(7); doc.setFont(FONT, 'bold'); doc.setTextColor(...C.text);
  doc.text('LEGEND', x, y);
  doc.setLineWidth(0.3); doc.line(x, y + 1, x + 50, y + 1);

  let ly = y + 6;
  doc.setFontSize(5); doc.setFont(FONT, 'normal');

  // Retaining wall
  doc.setLineWidth(0.6); doc.setDrawColor(...C.black);
  doc.line(x + 2, ly, x + 18, ly);
  for (let hx = x + 2; hx <= x + 18; hx += 2) { doc.setLineWidth(0.15); doc.line(hx, ly, hx - 1, ly + 1.5); }
  doc.text('PROPOSED RETAINING WALL. SEE TYPICAL DETAILS, RETAINING', x + 22, ly);
  doc.text('WALL NOTES AND SCHEDULES.', x + 22, ly + 3);
  ly += 8;

  // Boundary
  doc.setLineWidth(0.2); doc.setLineDashPattern([2, 1, 0.5, 1], 0);
  doc.line(x + 2, ly, x + 18, ly); doc.setLineDashPattern([], 0);
  doc.text('APPROXIMATE BOUNDARY LOCATION.', x + 22, ly);
  ly += 6;

  // Height circle
  doc.setLineWidth(0.3); doc.circle(x + 8, ly, 3, 'S');
  doc.setFont(FONT, 'bold'); doc.text('1.0', x + 6, ly + 1.5);
  doc.setFont(FONT, 'normal');
  doc.text('APPROXIMATE RETAINING WALL HEIGHT.', x + 22, ly);
  ly += 6;

  // Wall mark
  doc.setLineWidth(0.3); doc.rect(x + 4, ly - 2.5, 10, 5);
  doc.setFont(FONT, 'bold'); doc.text('RWA', x + 5.5, ly + 0.5);
  doc.setFont(FONT, 'normal');
  doc.text('RETAINING WALL MARK. REFER TYPICAL DETAILS, RETAINING WALL', x + 22, ly);
  doc.text('NOTES AND SCHEDULES.', x + 22, ly + 3);
  ly += 8;

  // HS / LS
  doc.setFont(FONT, 'bold');
  doc.text('HS', x + 7, ly + 1); doc.setFont(FONT, 'normal'); doc.text('HIGH SIDE.', x + 22, ly + 1);
  ly += 5;
  doc.setFont(FONT, 'bold');
  doc.text('LS', x + 7, ly + 1); doc.setFont(FONT, 'normal'); doc.text('LOW SIDE.', x + 22, ly + 1);

  // Elevation marker in legend
  ly += 8;
  const eCircR = 4;
  doc.setLineWidth(0.3); doc.circle(x + 8, ly, eCircR, 'S');
  doc.line(x + 8 - eCircR, ly, x + 8 + eCircR, ly);
  doc.setFont(FONT, 'bold'); doc.setFontSize(4.5);
  doc.text('A', x + 7, ly - 1); doc.text('1', x + 7, ly + 3);
  doc.setFont(FONT, 'normal'); doc.setFontSize(5);
  doc.text('ELEVATION MARKER. TOP = ID, BOTTOM = SHEET.', x + 22, ly + 1);
}

// ─── NOTE BOXES ───────────────────────────────────────────
function drawNoteBoxes(doc: jsPDF, x: number, y: number, maxW: number) {
  doc.setLineWidth(0.3); doc.setDrawColor(...C.black);
  doc.rect(x, y, maxW, 10);
  doc.setFontSize(5); doc.setFont(FONT, 'normal'); doc.setTextColor(...C.text);
  doc.text('NOTE: THIS DRAWING SHALL BE READ IN CONJUNCTION', x + 2, y + 4);
  doc.text('WITH THE ATTACHED RETAINING WALL NOTES', x + 2, y + 8);

  doc.rect(x, y + 12, maxW, 10);
  doc.text('NOTE: BOUNDARY LOCATIONS SHOWN INDICATIVELY', x + 2, y + 16);
  doc.text('ONLY. TO BE CONFIRMED BY A LICENSED SURVEYOR.', x + 2, y + 20);

  doc.rect(x, y + 24, maxW, 10);
  doc.text('NOTE: HEIGHTS OF RETAINING WALLS TO', x + 2, y + 28);
  doc.text('BE CONFIRMED ON SITE BY CONTRACTOR', x + 2, y + 32);
}

// ─── DIMENSION LINE ───────────────────────────────────────
function drawDimensionLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, value: number, offset: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return;
  const nx = (-dy / len) * offset, ny = (dx / len) * offset;
  const ox1 = x1 + nx, oy1 = y1 + ny, ox2 = x2 + nx, oy2 = y2 + ny;

  doc.setDrawColor(...C.black); doc.setLineWidth(0.12);
  doc.line(x1, y1, ox1, oy1);
  doc.line(x2, y2, ox2, oy2);
  doc.line(ox1, oy1, ox2, oy2);

  // Ticks
  const adx = dx / len * 1.2, ady = dy / len * 1.2;
  const andx = (-dy / len) * 0.5, andy = (dx / len) * 0.5;
  doc.line(ox1 - andx, oy1 - andy, ox1 + adx + andx, oy1 + ady + andy);
  doc.line(ox2 + andx, oy2 + andy, ox2 - adx - andx, oy2 - ady - andy);

  const mx = (ox1 + ox2) / 2, my = (oy1 + oy2) / 2;
  const dimText = Math.round(value).toString();
  doc.setFillColor(...C.white);
  const tw = doc.getTextWidth(dimText) + 2;
  doc.rect(mx - tw / 2, my - 2, tw, 3, 'F');
  doc.setFontSize(4.5); doc.setFont(FONT, 'normal'); doc.setTextColor(...C.black);
  doc.text(dimText, mx, my, { align: 'center' });
}

// ─── ELEVATION MARKER (circle with letter/sheet) ──────────
function drawElevationMarker(doc: jsPDF, cx: number, cy: number, letter: string, sheetNum: number) {
  const r = 4.5;
  doc.setLineWidth(0.4); doc.setDrawColor(...C.black); doc.setFillColor(...C.white);
  doc.circle(cx, cy, r, 'FD');
  doc.line(cx - r, cy, cx + r, cy);
  doc.setFontSize(5.5); doc.setFont(FONT, 'bold'); doc.setTextColor(...C.black);
  doc.text(letter, cx, cy - 1.5, { align: 'center' });
  doc.text(sheetNum.toString(), cx, cy + 3, { align: 'center' });
}

// ─── WALLS ON PLAN ────────────────────────────────────────
function drawWallsOnPlan(doc: jsPDF, walls: WallSegment[], bbox: BBox, a: DrawArea, elevSheetStart: number) {
  walls.forEach((wall, wallIdx) => {
    if (wall.points.length < 2) return;

    // Wall line
    doc.setDrawColor(...C.black); doc.setLineWidth(0.5);
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = toXY(wall.points[i].lng, wall.points[i].lat, bbox, a);
      const p2 = toXY(wall.points[i + 1].lng, wall.points[i + 1].lat, bbox, a);
      doc.line(p1.x, p1.y, p2.x, p2.y);
    }

    // Hatch ticks
    doc.setLineWidth(0.15);
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = toXY(wall.points[i].lng, wall.points[i].lat, bbox, a);
      const p2 = toXY(wall.points[i + 1].lng, wall.points[i + 1].lat, bbox, a);
      const dx = p2.x - p1.x, dy = p2.y - p1.y, l = Math.sqrt(dx * dx + dy * dy);
      if (l < 1) continue;
      const nx = -dy / l, ny = dx / l;
      const n = Math.max(2, Math.floor(l / 2.5));
      for (let t = 0; t <= n; t++) {
        const f = t / n;
        doc.line(p1.x + dx * f, p1.y + dy * f, p1.x + dx * f + nx * 1.8, p1.y + dy * f + ny * 1.8);
      }
    }

    // Height circles at nodes
    wall.points.forEach((p) => {
      const { x, y } = toXY(p.lng, p.lat, bbox, a);
      const ht = p.height ?? 0;
      if (ht > 0) {
        const r = 4;
        doc.setFillColor(...C.white); doc.setDrawColor(...C.black); doc.setLineWidth(0.3);
        doc.circle(x, y - 6, r, 'FD');
        doc.setFontSize(5); doc.setFont(FONT, 'bold'); doc.setTextColor(...C.black);
        doc.text(ht.toFixed(1), x, y - 5, { align: 'center' });
      } else {
        doc.setFillColor(...C.black); doc.circle(x, y, 0.8, 'F');
      }
    });

    // HS/LS labels
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = toXY(wall.points[i].lng, wall.points[i].lat, bbox, a);
      const p2 = toXY(wall.points[i + 1].lng, wall.points[i + 1].lat, bbox, a);
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x, dy = p2.y - p1.y, l = Math.sqrt(dx * dx + dy * dy);
      if (l < 5) continue;
      const nx = -dy / l, ny = dx / l;
      doc.setFontSize(4); doc.setFont(FONT, 'bold'); doc.setTextColor(...C.black);
      doc.text('HS', mx + nx * 5, my + ny * 5, { align: 'center' });
      doc.text('LS', mx - nx * 4, my - ny * 4, { align: 'center' });
    }

    // Wall label box at midpoint
    const mi = Math.floor(wall.points.length / 2);
    const mp1 = wall.points[Math.max(0, mi - 1)], mp2 = wall.points[Math.min(wall.points.length - 1, mi)];
    const lp = toXY((mp1.lng + mp2.lng) / 2, (mp1.lat + mp2.lat) / 2, bbox, a);
    const wallLabel = wall.name.replace('Wall ', 'RW');
    doc.setFillColor(...C.white); doc.setDrawColor(...C.black); doc.setLineWidth(0.3);
    doc.rect(lp.x - 7, lp.y - 2.5, 14, 5, 'FD');
    doc.setFontSize(5); doc.setFont(FONT, 'bold'); doc.setTextColor(...C.black);
    doc.text(wallLabel, lp.x, lp.y + 1.5, { align: 'center' });

    // Segment dimension lines
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = toXY(wall.points[i].lng, wall.points[i].lat, bbox, a);
      const p2 = toXY(wall.points[i + 1].lng, wall.points[i + 1].lat, bbox, a);
      const segLen = calculateDistance(wall.points[i], wall.points[i + 1]);
      drawDimensionLine(doc, p1.x, p1.y, p2.x, p2.y, segLen * 1000, -8);
    }

    // Total wall length dimension
    if (wall.points.length > 2) {
      const first = toXY(wall.points[0].lng, wall.points[0].lat, bbox, a);
      const last = toXY(wall.points[wall.points.length - 1].lng, wall.points[wall.points.length - 1].lat, bbox, a);
      drawDimensionLine(doc, first.x, first.y, last.x, last.y, wall.length * 1000, -14);
    }

    // ── Elevation marker on site plan ──
    // Place near the first point of the wall
    const ep = toXY(wall.points[0].lng, wall.points[0].lat, bbox, a);
    const letter = String.fromCharCode(65 + wallIdx);
    drawElevationMarker(doc, ep.x - 8, ep.y + 8, letter, elevSheetStart + wallIdx);
  });
}

// ─── STEPPED ELEVATION VIEW ──────────────────────────────
function drawSteppedElevation(
  doc: jsPDF,
  wall: WallSegment,
  drawAreaLeft: number,
  drawAreaRight: number,
  baseY: number,
  elevIdx: number,
  sheetIdx: number
) {
  const wallLen = wall.length || 3;
  const availW = drawAreaRight - drawAreaLeft;

  // Calculate scale to fit nicely - centre the elevation
  const hScale = Math.min(availW * 0.6 / wallLen, 5);
  const vScale = hScale; // 1:1 aspect

  const wW = wallLen * hScale;
  const centreX = drawAreaLeft + availW / 2;
  const ox = centreX - wW / 2;

  const groundY = baseY;

  // ── Ground line with hatch ──
  const gExtL = 10, gExtR = 15;
  doc.setDrawColor(...C.black); doc.setLineWidth(0.4);
  doc.line(ox - gExtL, groundY, ox + wW + gExtR, groundY);
  doc.setLineWidth(0.12);
  for (let gx = ox - gExtL; gx < ox + wW + gExtR; gx += 2) {
    doc.line(gx, groundY, gx - 1.2, groundY + 1.5);
  }

  // ── Stepped wall profile using actual node heights ──
  // Each node has its own height; the wall steps between them
  // Build profile: for each segment, use the height at the START node (step happens at the next node)
  const segHeights: { startX: number; endX: number; height: number; segLen: number; }[] = [];
  let cumLen = 0;
  for (let i = 0; i < wall.points.length - 1; i++) {
    const segLen = calculateDistance(wall.points[i], wall.points[i + 1]);
    const h = wall.points[i].height ?? 0;
    segHeights.push({
      startX: ox + cumLen * hScale,
      endX: ox + (cumLen + segLen) * hScale,
      height: h > 0 ? h : (wall.maxHeight || 1),
      segLen,
    });
    cumLen += segLen;
  }

  // Draw stepped profile
  doc.setLineWidth(0.4); doc.setDrawColor(...C.black);

  if (segHeights.length === 0) {
    const maxH2 = wall.maxHeight || 1;
    const wH = maxH2 * vScale;
    doc.rect(ox, groundY - wH, wW, wH);
  } else {
    // Draw outline as a stepped profile path
    // Bottom line (ground)
    doc.setLineWidth(0.4);
    doc.line(ox, groundY, ox + wW, groundY);

    // Left edge up
    const firstH = segHeights[0].height * vScale;
    doc.line(ox, groundY, ox, groundY - firstH);

    // Top profile with steps
    for (let i = 0; i < segHeights.length; i++) {
      const seg = segHeights[i];
      const bayH = seg.height * vScale;
      // Horizontal top of this bay
      doc.line(seg.startX, groundY - bayH, seg.endX, groundY - bayH);

      // Step transition to next bay
      if (i < segHeights.length - 1) {
        const nextH = segHeights[i + 1].height * vScale;
        doc.line(seg.endX, groundY - bayH, seg.endX, groundY - nextH);
      }

      // Vertical edges
      if (i === 0) {
        // Left edge already drawn
      }
      if (i === segHeights.length - 1) {
        // Right edge down
        doc.line(seg.endX, groundY - bayH, seg.endX, groundY);
      }

      // Sleeper courses for sleeper/timber walls
      if (wall.wallType === 'concrete-sleeper' || wall.wallType === 'timber') {
        const courseH = 0.2 * vScale; // 200mm sleeper height
        const numCourses = Math.max(1, Math.round(bayH / courseH));
        const actualCH = bayH / numCourses;
        for (let c = 1; c < numCourses; c++) {
          doc.setLineWidth(0.15);
          doc.line(seg.startX, groundY - c * actualCH, seg.endX, groundY - c * actualCH);
        }
      }

      // Cross hatch for concrete types
      if (wall.wallType === 'reinforced-concrete' || wall.wallType === 'reinforced-masonry') {
        doc.setLineWidth(0.08);
        const step = Math.max(2, bayH / 6);
        for (let hy = groundY - bayH; hy < groundY; hy += step) {
          doc.line(seg.startX, hy, Math.min(seg.startX + step * 2, seg.endX), Math.min(hy + step, groundY));
        }
      }
    }

    // ── I-beam / steel posts at 2m spacing ──
    if (wall.wallType === 'concrete-sleeper') {
      const postSpacingM = 2.0; // 2m centres
      const postSpacingPx = postSpacingM * hScale;
      doc.setLineWidth(0.3); doc.setDrawColor(...C.black);

      // Place posts from start at 2m intervals
      for (let px = ox; px <= ox + wW + 0.1; px += postSpacingPx) {
        // Find the height at this position
        let postH = (segHeights[0]?.height || 1) * vScale;
        for (const seg of segHeights) {
          if (px >= seg.startX - 0.1 && px <= seg.endX + 0.1) {
            postH = seg.height * vScale;
            break;
          }
        }
        // Draw I-beam profile (two flanges + web)
        const flangeW = 1.2;
        doc.setLineWidth(0.3);
        // Web (vertical line)
        doc.line(px, groundY, px, groundY - postH);
        // Top flange
        doc.line(px - flangeW, groundY - postH, px + flangeW, groundY - postH);
        // Bottom flange
        doc.line(px - flangeW, groundY, px + flangeW, groundY);
      }

      // Also place a post at the very end if not already there
      const lastPostX = ox + wW;
      const lastPx = Math.floor(wW / postSpacingPx) * postSpacingPx + ox;
      if (Math.abs(lastPostX - lastPx) > 1) {
        const lastSeg = segHeights[segHeights.length - 1];
        const lastH = lastSeg.height * vScale;
        const flangeW = 1.2;
        doc.line(lastPostX, groundY, lastPostX, groundY - lastH);
        doc.line(lastPostX - flangeW, groundY - lastH, lastPostX + flangeW, groundY - lastH);
        doc.line(lastPostX - flangeW, groundY, lastPostX + flangeW, groundY);
      }
    }

    // ── Per-bay height annotations ──
    segHeights.forEach(seg => {
      const bayH = seg.height * vScale;
      const midX = (seg.startX + seg.endX) / 2;
      doc.setFontSize(4); doc.setFont(FONT, 'normal'); doc.setTextColor(...C.black);
      doc.text(`${seg.height.toFixed(1)}m`, midX, groundY - bayH - 2, { align: 'center' });
    });
  }

  // ── Footing ──
  const maxHPx = Math.max(...segHeights.map(s => s.height * vScale), (wall.maxHeight || 1) * vScale);
  const footH = Math.max(0.2 * vScale, 2);
  const fExtend = Math.max(1.5 * hScale, 3);
  doc.setLineWidth(0.3);
  doc.rect(ox - fExtend / 2, groundY, wW + fExtend, footH);

  // ── Top length dimension ──
  const topDimY = groundY - maxHPx - 8;
  doc.setLineWidth(0.15);
  doc.line(ox, topDimY, ox + wW, topDimY);
  doc.line(ox, topDimY - 1, ox, groundY - maxHPx);
  doc.line(ox + wW, topDimY - 1, ox + wW, groundY - maxHPx);
  doc.setFillColor(...C.black);
  doc.triangle(ox, topDimY, ox + 1, topDimY - 0.5, ox + 1, topDimY + 0.5, 'F');
  doc.triangle(ox + wW, topDimY, ox + wW - 1, topDimY - 0.5, ox + wW - 1, topDimY + 0.5, 'F');
  doc.setFontSize(5); doc.setFont(FONT, 'normal'); doc.setTextColor(...C.black);
  doc.text(Math.round(wallLen * 1000).toString(), centreX, topDimY - 2, { align: 'center' });

  // ── Bay-by-bay dimensions along top ──
  if (segHeights.length > 1) {
    const bayDimY = topDimY + 4;
    segHeights.forEach(seg => {
      const bayLen = (seg.endX - seg.startX) / hScale;
      doc.setLineWidth(0.1);
      doc.line(seg.startX, bayDimY, seg.endX, bayDimY);
      // Ticks
      doc.line(seg.startX, bayDimY - 0.8, seg.startX, bayDimY + 0.8);
      doc.line(seg.endX, bayDimY - 0.8, seg.endX, bayDimY + 0.8);
      doc.setFontSize(3.5);
      doc.text(Math.round(bayLen * 1000).toString(), (seg.startX + seg.endX) / 2, bayDimY - 1.5, { align: 'center' });
    });
  }

  // ── Left height dimension (max) ──
  const maxH = Math.max(...segHeights.map(s => s.height), wall.maxHeight || 1);
  const maxHPixels = maxH * vScale;
  const dimX = ox - gExtL - 4;
  doc.setLineWidth(0.15);
  doc.line(dimX, groundY, dimX, groundY - maxHPixels);
  doc.line(dimX - 1, groundY, ox - 1, groundY);
  doc.line(dimX - 1, groundY - maxHPixels, ox - 1, groundY - maxHPixels);
  doc.setFillColor(...C.black);
  doc.triangle(dimX, groundY, dimX - 0.5, groundY - 1, dimX + 0.5, groundY - 1, 'F');
  doc.triangle(dimX, groundY - maxHPixels, dimX - 0.5, groundY - maxHPixels + 1, dimX + 0.5, groundY - maxHPixels + 1, 'F');
  doc.setFontSize(5); doc.setFont(FONT, 'normal');
  doc.text(Math.round(maxH * 1000).toString(), dimX - 2, groundY - maxHPixels / 2 + 1, { angle: 90 });

  // ── Fence above ──
  if (wall.hasFenceAbove) {
    const fenceRealH = wall.fenceHeight || 1.5; // metres
    const fenceH = fenceRealH * vScale;
    doc.setDrawColor(...C.black); doc.setLineWidth(0.25);
    const numPosts = Math.max(2, Math.ceil(wW / 10));
    const postSpacing = wW / (numPosts - 1);
    for (let i = 0; i < numPosts; i++) {
      const fx = ox + i * postSpacing;
      doc.line(fx, groundY - maxHPixels, fx, groundY - maxHPixels - fenceH);
    }
    doc.line(ox, groundY - maxHPixels - fenceH, ox + wW, groundY - maxHPixels - fenceH);
    doc.line(ox, groundY - maxHPixels - fenceH * 0.5, ox + wW, groundY - maxHPixels - fenceH * 0.5);

    // Fence height dimension on right
    const fDimX = ox + wW + 5;
    doc.setLineWidth(0.12);
    doc.line(fDimX, groundY - maxHPixels, fDimX, groundY - maxHPixels - fenceH);
    doc.line(fDimX - 1, groundY - maxHPixels, ox + wW + 1, groundY - maxHPixels);
    doc.line(fDimX - 1, groundY - maxHPixels - fenceH, ox + wW + 1, groundY - maxHPixels - fenceH);
    doc.setFillColor(...C.black);
    doc.triangle(fDimX, groundY - maxHPixels, fDimX - 0.4, groundY - maxHPixels - 0.8, fDimX + 0.4, groundY - maxHPixels - 0.8, 'F');
    doc.triangle(fDimX, groundY - maxHPixels - fenceH, fDimX - 0.4, groundY - maxHPixels - fenceH + 0.8, fDimX + 0.4, groundY - maxHPixels - fenceH + 0.8, 'F');
    doc.setFontSize(4); doc.setFont(FONT, 'normal'); doc.setTextColor(...C.black);
    doc.text(Math.round(fenceRealH * 1000).toString(), fDimX + 1, groundY - maxHPixels - fenceH / 2 + 1);
  }

  // ── Wall label box ──
  const wallLabel = wall.name.replace('Wall ', 'RW');
  doc.setFillColor(...C.white); doc.setDrawColor(...C.black); doc.setLineWidth(0.3);
  const lblX = centreX - 7, lblY2 = groundY - maxHPixels / 2 - 2.5;
  doc.rect(lblX, lblY2, 14, 5, 'FD');
  doc.setFontSize(5); doc.setFont(FONT, 'bold'); doc.setTextColor(...C.black);
  doc.text(wallLabel, centreX, lblY2 + 3.5, { align: 'center' });

  // ── Elevation label with marker ──
  const elevLabelY = groundY + footH + 12;
  const letter = String.fromCharCode(65 + elevIdx);
  doc.setFontSize(10); doc.setFont(FONT, 'bold');
  doc.text('ELEVATION', centreX - 15, elevLabelY);
  drawElevationMarker(doc, centreX + 12, elevLabelY - 3, letter, sheetIdx);
  doc.setFontSize(5); doc.setFont(FONT, 'normal');
  doc.text('SCALE 1:200', centreX - 15, elevLabelY + 4);
}

// ─── MAIN EXPORT ──────────────────────────────────────────
export async function generateEngineeringSitePlan(project: ProjectState, googleMapsApiKey?: string, branding?: BrandingConfig) {
  const doc = new jsPDF('landscape', 'mm', 'a3');
  const logoDataUrl = await loadLogoDataUrl();

  const drawingAreaLeft = BORDER_INNER + 5;
  const drawingAreaRight = A3_W - BORDER_INNER - TB_WIDTH - 5;
  const totalSheets = 1 + project.walls.length; // 1 site plan + 1 per wall
  const drawingNoBase = `OB-${project.details.clientName?.replace(/\s+/g, '').substring(0, 6).toUpperCase() || 'XXXXX'}`;

  // ═══ PAGE 1: SITE PLAN ═══════════════════════════════════
  drawBorder(doc);
  drawWatermark(doc);

  if (project.walls.length > 0 && project.walls.some(w => w.points.length >= 2)) {
    const planArea: DrawArea = {
      x: drawingAreaLeft,
      y: BORDER_INNER + 5,
      w: drawingAreaRight - drawingAreaLeft,
      h: A3_H - BORDER_INNER * 2 - 10,
    };

    const bbox = get1to200BBox(project.walls, planArea);

    // Satellite underlay at 50% opacity
    if (googleMapsApiKey) {
      try {
        const imgData = await fetchSatelliteImage(bbox, 640, 512, googleMapsApiKey);
        if (imgData) {
          doc.saveGraphicsState();
          doc.setGState(new (doc as any).GState({ opacity: 0.5 }));
          doc.addImage(imgData, 'PNG', planArea.x, planArea.y, planArea.w, planArea.h);
          doc.restoreGraphicsState();
        }
      } catch { /* proceed without */ }
    }

    drawWallsOnPlan(doc, project.walls, bbox, planArea, 2);

    // North arrow
    drawNorthArrow(doc, BORDER_INNER + 20, BORDER_INNER + 22);

    // Legend - right-aligned, close to the title block
    const tbX = A3_W - BORDER_INNER - TB_WIDTH;
    const legendX = tbX - 165;
    drawLegend(doc, legendX, BORDER_INNER + 10);

    // Note boxes - right-aligned near title block
    drawNoteBoxes(doc, legendX, BORDER_INNER + 65, tbX - legendX - 5);

    // Scale label bottom-left
    doc.setFontSize(10); doc.setFont(FONT, 'bold'); doc.setTextColor(...C.black);
    doc.text('SITE PLAN', BORDER_INNER + 30, A3_H - BORDER_INNER - 10);
    doc.setFontSize(6); doc.setFont(FONT, 'normal');
    doc.text('SCALE 1:200', BORDER_INNER + 30, A3_H - BORDER_INNER - 5);
  } else {
    doc.setFontSize(11); doc.setFont(FONT, 'italic'); doc.setTextColor(160, 160, 160);
    doc.text('No wall segments drawn — plan view unavailable', A3_W / 2 - 55, A3_H / 2);
  }

  drawTitleBlock(doc, project, branding, logoDataUrl, {
    drawingTitle: 'SITE PLAN',
    scale: '1: 200',
    sheetNum: 1,
    totalSheets,
    drawingNo: `${drawingNoBase}-1`,
  });

  // ═══ ELEVATION PAGES (one per wall) ══════════════════════
  project.walls.forEach((wall, idx) => {
    doc.addPage([420, 297], 'landscape');
    drawBorder(doc);

    // Note boxes - right-aligned near title block
    const tbX2 = A3_W - BORDER_INNER - TB_WIDTH;
    const noteX = tbX2 - 165;
    drawNoteBoxes(doc, noteX, BORDER_INNER + 10, tbX2 - noteX - 5);

    // Centre the elevation vertically
    const elevBaseY = BORDER_INNER + (A3_H - BORDER_INNER * 2) * 0.6;
    drawSteppedElevation(doc, wall, drawingAreaLeft, drawingAreaRight, elevBaseY, idx, idx + 2);

    drawTitleBlock(doc, project, branding, logoDataUrl, {
      drawingTitle: `ELEVATION ${String.fromCharCode(65 + idx)} — ${wall.name.toUpperCase()}`,
      scale: '1: 200',
      sheetNum: idx + 2,
      totalSheets,
      drawingNo: `${drawingNoBase}-${idx + 2}`,
    });
  });

  doc.save(`concept-site-plan-${project.details.clientName?.replace(/\s+/g, '-') || 'export'}.pdf`);
}
