import jsPDF from 'jspdf';
import { ProjectState, WALL_TYPE_LABELS, WallSegment, WallType } from '@/lib/types';
import { getTotalWallLength, calculateDistance } from '@/lib/wallCalculations';
import { BrandingConfig } from '@/lib/branding';

// ─── COLOUR PALETTE ────────────────────────────────────────
type RGB = [number, number, number];
const C = {
  black:      [0, 0, 0]          as RGB,
  border:     [0, 0, 0]          as RGB,
  wall:       [0, 0, 0]          as RGB,
  dimension:  [0, 0, 0]          as RGB,
  text:       [0, 0, 0]          as RGB,
  textLight:  [80, 80, 80]       as RGB,
  white:      [255, 255, 255]    as RGB,
  soil:       [0, 0, 0]          as RGB,
  soilFill:   [240, 240, 240]    as RGB,
  concFill:   [245, 245, 245]    as RGB,
  concrete:   [0, 0, 0]          as RGB,
  green:      [0, 0, 0]          as RGB,
  fence:      [0, 0, 0]          as RGB,
};

// ─── CONSTANTS ─────────────────────────────────────────────
const A3_W = 420; // mm
const A3_H = 297; // mm
const BORDER_OUTER = 5; // mm from page edge
const BORDER_INNER = 7; // mm from page edge
const TB_WIDTH = 130; // title block width mm
const FONT = 'helvetica';

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

/** Compute bbox that corresponds to exactly 1:200 scale for a given draw area */
function get1to200BBox(walls: WallSegment[], area: DrawArea): BBox {
  // 1:200 means 1mm on paper = 200mm = 0.2m in reality
  // So the draw area covers area.w * 0.2m horizontally and area.h * 0.2m vertically
  const realW = area.w * 0.2; // metres
  const realH = area.h * 0.2; // metres

  // Get centre of walls
  let cLng = 0, cLat = 0, n = 0;
  walls.forEach(w => w.points.forEach(p => { cLng += p.lng; cLat += p.lat; n++; }));
  if (n === 0) return { minLng: 0, maxLng: 1, minLat: 0, maxLat: 1 };
  cLng /= n; cLat /= n;

  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(cLat * Math.PI / 180);

  const halfLatSpan = (realH / 2) / mPerDegLat;
  const halfLngSpan = (realW / 2) / mPerDegLng;

  return {
    minLng: cLng - halfLngSpan,
    maxLng: cLng + halfLngSpan,
    minLat: cLat - halfLatSpan,
    maxLat: cLat + halfLatSpan,
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
    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${cLat},${cLng}&zoom=${zoom}&size=${widthPx}x${heightPx}&scale=2&maptype=satellite&style=feature:all|element:labels|visibility:off&key=${token}`;
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

// ─── LOAD LOGO AS DATA URL ────────────────────────────────
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

// ─── DRAWING PRIMITIVES ───────────────────────────────────

function drawBorder(doc: jsPDF) {
  // Outer border
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.5);
  doc.rect(BORDER_OUTER, BORDER_OUTER, A3_W - BORDER_OUTER * 2, A3_H - BORDER_OUTER * 2);
  // Inner border
  doc.setLineWidth(0.2);
  doc.rect(BORDER_INNER, BORDER_INNER, A3_W - BORDER_INNER * 2, A3_H - BORDER_INNER * 2);
}

function drawTitleBlock(
  doc: jsPDF,
  project: ProjectState,
  branding: BrandingConfig | undefined,
  logoDataUrl: string | null,
  opts: {
    drawingTitle: string;
    scale: string;
    sheetNum: number;
    totalSheets: number;
    drawingNo: string;
  }
) {
  const tbX = A3_W - BORDER_INNER - TB_WIDTH;
  const tbTop = BORDER_INNER;
  const tbBottom = A3_H - BORDER_INNER;
  const tbH = tbBottom - tbTop;

  // Vertical line separating title block from drawing area
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.5);
  doc.line(tbX, tbTop, tbX, tbBottom);

  // ── Revision table at top ──
  const revTableH = 20;
  const revY = tbTop;
  // Horizontal lines
  doc.setLineWidth(0.2);
  // Empty revision rows (5 rows)
  for (let i = 0; i < 5; i++) {
    const ry = revY + i * 3;
    doc.line(tbX, ry + 3, tbX + TB_WIDTH, ry + 3);
  }
  // Bottom label row
  const labelY = revY + 15;
  doc.setLineWidth(0.3);
  doc.line(tbX, labelY, tbX + TB_WIDTH, labelY);
  // Column dividers
  const dateColW = 30;
  const descColW = TB_WIDTH - dateColW - 15;
  doc.line(tbX + dateColW, revY, tbX + dateColW, labelY + 5);
  doc.line(tbX + dateColW + descColW, revY, tbX + dateColW + descColW, labelY + 5);

  // Labels
  doc.setFontSize(5);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(...C.text);
  doc.text('DATE', tbX + dateColW / 2, labelY + 4, { align: 'center' });
  doc.text('DESCRIPTION', tbX + dateColW + descColW / 2, labelY + 4, { align: 'center' });
  doc.text('REV', tbX + dateColW + descColW + 7.5, labelY + 4, { align: 'center' });

  // First revision entry
  doc.setFont(FONT, 'normal');
  doc.setFontSize(5);
  const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: '2-digit' });
  doc.text(dateStr, tbX + dateColW / 2, revY + 2.5, { align: 'center' });
  doc.text('PRELIMINARY ISSUE', tbX + dateColW + descColW / 2, revY + 2.5, { align: 'center' });
  doc.text('0', tbX + dateColW + descColW + 7.5, revY + 2.5, { align: 'center' });

  // Separator below revision table
  const afterRevY = labelY + 5;
  doc.setLineWidth(0.3);
  doc.line(tbX, afterRevY, tbX + TB_WIDTH, afterRevY);

  // ── Logo area ──
  const logoAreaY = afterRevY;
  const logoAreaH = 45;
  if (logoDataUrl) {
    try {
      // Centre the logo
      const logoW = 50;
      const logoH = 35;
      const logoX = tbX + (TB_WIDTH - logoW) / 2;
      const logoY = logoAreaY + 3;
      doc.addImage(logoDataUrl, 'JPEG', logoX, logoY, logoW, logoH);
    } catch { /* skip logo */ }
  }

  // "CIVIL AND STRUCTURAL" text below logo
  doc.setFontSize(6);
  doc.setFont(FONT, 'normal');
  doc.text('CIVIL AND STRUCTURAL', tbX + TB_WIDTH / 2, logoAreaY + logoAreaH - 3, { align: 'center' });

  // Separator
  const afterLogoY = logoAreaY + logoAreaH;
  doc.setLineWidth(0.2);
  doc.line(tbX, afterLogoY, tbX + TB_WIDTH, afterLogoY);

  // ── Company details ──
  let cy = afterLogoY + 4;
  doc.setFontSize(5);
  doc.setFont(FONT, 'normal');
  const companyInfo = [
    'ABN: 69 661 191 304',
    '1A Tarton Road,',
    'Holden Hill SA, 5088',
    'Telephone: 0480 632 951',
    'www.obengineering.com.au',
  ];
  companyInfo.forEach(line => {
    doc.text(line, tbX + 3, cy);
    cy += 3.2;
  });

  // Separator
  cy += 1;
  doc.setLineWidth(0.3);
  doc.line(tbX, cy, tbX + TB_WIDTH, cy);

  // ── Project name ──
  cy += 3;
  doc.setFontSize(5);
  doc.setFont(FONT, 'normal');
  doc.text('PROJECT NAME', tbX + 3, cy);
  cy += 4;
  doc.setFontSize(8);
  doc.setFont(FONT, 'bold');
  doc.text('PROPOSED RETAINING', tbX + 3, cy);
  cy += 4.5;
  doc.text('WALL', tbX + 3, cy);
  cy += 5;

  // Address
  doc.setFontSize(7);
  const addr = project.details.address || 'N/A';
  const lines = doc.splitTextToSize(addr.toUpperCase(), TB_WIDTH - 6);
  lines.forEach((line: string) => {
    doc.text(line, tbX + 3, cy);
    cy += 4;
  });

  // Separator
  cy += 1;
  doc.line(tbX, cy, tbX + TB_WIDTH, cy);

  // ── Client ──
  cy += 3;
  doc.setFontSize(5);
  doc.setFont(FONT, 'normal');
  doc.text('CLIENT', tbX + 3, cy);
  cy += 4;
  doc.setFontSize(7);
  doc.setFont(FONT, 'bold');
  doc.text((project.details.clientName || 'N/A').toUpperCase(), tbX + 3, cy);

  // Separator
  cy += 5;
  doc.line(tbX, cy, tbX + TB_WIDTH, cy);

  // ── Drawing title ──
  cy += 3;
  doc.setFontSize(5);
  doc.setFont(FONT, 'normal');
  doc.text('DRAWING TITLE', tbX + 3, cy);
  cy += 5;
  doc.setFontSize(8);
  doc.setFont(FONT, 'bold');
  doc.text(opts.drawingTitle.toUpperCase(), tbX + 3, cy);

  // Separator
  cy += 5;
  doc.setLineWidth(0.2);
  doc.line(tbX, cy, tbX + TB_WIDTH, cy);

  // ── Signature line ──
  cy += 3;
  doc.line(tbX + 3, cy, tbX + TB_WIDTH - 3, cy);

  // ── Designed / Drawn / Date / Scale grid ──
  cy += 3;
  const gridH = 7;
  const halfW = TB_WIDTH / 2;

  // Row 1: DESIGNED / DATE
  doc.setLineWidth(0.2);
  doc.rect(tbX, cy, halfW, gridH);
  doc.rect(tbX + halfW, cy, halfW, gridH);
  doc.setFontSize(4.5);
  doc.setFont(FONT, 'normal');
  doc.text('DESIGNED', tbX + 2, cy + 3);
  doc.setFont(FONT, 'bold');
  doc.text('S.A', tbX + 22, cy + 3);
  doc.text('DATE', tbX + halfW + 2, cy + 3);
  doc.text(dateStr, tbX + halfW + 18, cy + 3);
  cy += gridH;

  // Row 2: DRAWN / SCALE
  doc.rect(tbX, cy, halfW, gridH);
  doc.rect(tbX + halfW, cy, halfW, gridH);
  doc.setFont(FONT, 'normal');
  doc.text('DRAWN', tbX + 2, cy + 3);
  doc.setFont(FONT, 'bold');
  doc.text('S.A', tbX + 22, cy + 3);
  doc.text('SCALE', tbX + halfW + 2, cy + 3);
  doc.text(opts.scale, tbX + halfW + 18, cy + 3);
  cy += gridH;

  // ── Drawing status ──
  doc.setFontSize(5);
  doc.setFont(FONT, 'normal');
  doc.text('DRAWING STATUS:', tbX + 3, cy + 3);
  cy += 5;
  doc.setFontSize(8);
  doc.setFont(FONT, 'bold');
  doc.text('PRELIMINARY ISSUE', tbX + 3, cy + 3);

  // Separator
  cy += 7;
  doc.setLineWidth(0.3);
  doc.line(tbX, cy, tbX + TB_WIDTH, cy);

  // ── Drawing number ──
  cy += 3;
  doc.setFontSize(5);
  doc.setFont(FONT, 'normal');
  doc.text('DRAWING No:', tbX + 3, cy);
  doc.text('REV', tbX + TB_WIDTH - 15, cy);
  cy += 5;
  doc.setFontSize(12);
  doc.setFont(FONT, 'bold');
  doc.text(opts.drawingNo, tbX + 3, cy);
  doc.text('0', tbX + TB_WIDTH - 8, cy);

  // ── Vertical scale text on left edge of title block ──
  doc.setFontSize(5);
  doc.setFont(FONT, 'normal');
  doc.setTextColor(...C.text);
  const scaleText = `SCALE ${opts.scale} @ A3`;
  doc.text(scaleText, tbX - 2, tbBottom - 10, { angle: 90 });

  // ── Copyright text (left side vertical) ──
  doc.setFontSize(4);
  doc.setFont(FONT, 'normal');
  const year = new Date().getFullYear();
  doc.text(`© Copyright ${year}. OB ENGINEERING GROUP Pty. Ltd.`, BORDER_INNER + 2, tbBottom - 5, { angle: 90 });
}

// ─── NORTH ARROW (CAD style) ──────────────────────────────
function drawNorthArrow(doc: jsPDF, cx: number, cy: number) {
  const size = 12;
  // Arrow triangle
  doc.setFillColor(...C.black);
  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.3);
  // Filled north half
  doc.triangle(cx, cy - size, cx - 4, cy + 2, cx, cy - 2, 'F');
  // Open south half
  doc.triangle(cx, cy - size, cx + 4, cy + 2, cx, cy - 2, 'S');
  // N label
  doc.setFontSize(10);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(...C.black);
  doc.text('N', cx - 3, cy - size - 3);
}

// ─── LEGEND BOX ───────────────────────────────────────────
function drawLegend(doc: jsPDF, x: number, y: number) {
  doc.setFontSize(7);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(...C.text);
  doc.text('LEGEND', x, y);
  doc.setLineWidth(0.3);
  doc.line(x, y + 1, x + 50, y + 1);

  let ly = y + 6;
  doc.setFontSize(5);
  doc.setFont(FONT, 'normal');

  // Retaining wall symbol
  doc.setLineWidth(0.6);
  doc.setDrawColor(...C.black);
  doc.line(x + 2, ly, x + 18, ly);
  // Hatch ticks
  for (let hx = x + 2; hx <= x + 18; hx += 2) {
    doc.setLineWidth(0.15);
    doc.line(hx, ly, hx - 1, ly + 1.5);
  }
  doc.text('PROPOSED RETAINING WALL. SEE TYPICAL DETAILS, RETAINING', x + 22, ly);
  doc.text('WALL NOTES AND SCHEDULES.', x + 22, ly + 3);
  ly += 8;

  // Boundary symbol
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([2, 1, 0.5, 1], 0);
  doc.line(x + 2, ly, x + 18, ly);
  doc.setLineDashPattern([], 0);
  doc.text('APPROXIMATE BOUNDARY LOCATION.', x + 22, ly);
  ly += 6;

  // Height circle
  doc.setLineWidth(0.3);
  doc.circle(x + 8, ly, 3, 'S');
  doc.setFontSize(5);
  doc.setFont(FONT, 'bold');
  doc.text('1.0', x + 6, ly + 1.5);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(5);
  doc.text('APPROXIMATE RETAINING WALL HEIGHT.', x + 22, ly);
  ly += 6;

  // Wall mark
  doc.setLineWidth(0.3);
  doc.rect(x + 4, ly - 2.5, 10, 5);
  doc.setFontSize(5);
  doc.setFont(FONT, 'bold');
  doc.text('RWA', x + 5.5, ly + 0.5);
  doc.setFont(FONT, 'normal');
  doc.setFontSize(5);
  doc.text('RETAINING WALL MARK. REFER TYPICAL DETAILS, RETAINING WALL', x + 22, ly);
  doc.text('NOTES AND SCHEDULES.', x + 22, ly + 3);
  ly += 8;

  // HS / LS
  doc.setFont(FONT, 'bold');
  doc.text('HS', x + 7, ly + 1);
  doc.setFont(FONT, 'normal');
  doc.text('HIGH SIDE.', x + 22, ly + 1);
  ly += 5;

  doc.setFont(FONT, 'bold');
  doc.text('LS', x + 7, ly + 1);
  doc.setFont(FONT, 'normal');
  doc.text('LOW SIDE.', x + 22, ly + 1);
}

// ─── NOTE BOXES ───────────────────────────────────────────
function drawNoteBoxes(doc: jsPDF, x: number, y: number) {
  doc.setLineWidth(0.3);
  doc.setDrawColor(...C.black);

  // Note box 1
  doc.rect(x, y, 160, 10);
  doc.setFontSize(5);
  doc.setFont(FONT, 'normal');
  doc.setTextColor(...C.text);
  doc.text('NOTE: THIS DRAWING SHALL BE READ IN CONJUNCTION', x + 2, y + 4);
  doc.text('WITH THE ATTACHED RETAINING WALL NOTES', x + 2, y + 8);

  // Note box 2
  doc.rect(x, y + 12, 160, 10);
  doc.text('NOTE: BOUNDARY LOCATIONS SHOWN INDICATIVELY', x + 2, y + 16);
  doc.text('ONLY. TO BE CONFIRMED BY A LICENSED SURVEYOR.', x + 2, y + 20);

  return y + 25;
}

// ─── SITE PLAN: WALLS WITH HEIGHT CIRCLES ─────────────────
function drawWallsOnPlan(doc: jsPDF, walls: WallSegment[], bbox: BBox, a: DrawArea) {
  walls.forEach(wall => {
    if (wall.points.length < 2) return;

    // Wall line - thin solid
    doc.setDrawColor(...C.black);
    doc.setLineWidth(0.5);
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = toXY(wall.points[i].lng, wall.points[i].lat, bbox, a);
      const p2 = toXY(wall.points[i + 1].lng, wall.points[i + 1].lat, bbox, a);
      doc.line(p1.x, p1.y, p2.x, p2.y);
    }

    // Hatch ticks on retained side
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

    // Height circles at each node
    wall.points.forEach((p) => {
      const { x, y } = toXY(p.lng, p.lat, bbox, a);
      const ht = p.height ?? 0;
      if (ht > 0) {
        const r = 4;
        doc.setFillColor(...C.white);
        doc.setDrawColor(...C.black);
        doc.setLineWidth(0.3);
        doc.circle(x, y - 6, r, 'FD');
        doc.setFontSize(5);
        doc.setFont(FONT, 'bold');
        doc.setTextColor(...C.black);
        doc.text(ht.toFixed(1), x, y - 5, { align: 'center' });
      } else {
        // Small dot for nodes without height
        doc.setFillColor(...C.black);
        doc.circle(x, y, 0.8, 'F');
      }
    });

    // HS/LS labels at midpoints of segments
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = toXY(wall.points[i].lng, wall.points[i].lat, bbox, a);
      const p2 = toXY(wall.points[i + 1].lng, wall.points[i + 1].lat, bbox, a);
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const l = Math.sqrt(dx * dx + dy * dy);
      if (l < 5) continue;
      const nx = -dy / l, ny = dx / l;

      doc.setFontSize(4);
      doc.setFont(FONT, 'bold');
      doc.setTextColor(...C.black);
      // HS on hatch side
      doc.text('HS', mx + nx * 5, my + ny * 5, { align: 'center' });
      // LS on other side
      doc.text('LS', mx - nx * 4, my - ny * 4, { align: 'center' });
    }

    // Wall label box at midpoint
    const mi = Math.floor(wall.points.length / 2);
    const mp1 = wall.points[Math.max(0, mi - 1)], mp2 = wall.points[Math.min(wall.points.length - 1, mi)];
    const lp = toXY((mp1.lng + mp2.lng) / 2, (mp1.lat + mp2.lat) / 2, bbox, a);
    const wallLabel = wall.name.replace('Wall ', 'RW');
    const boxW = 14;
    const boxH = 5;
    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.black);
    doc.setLineWidth(0.3);
    doc.rect(lp.x - boxW / 2, lp.y - boxH / 2, boxW, boxH, 'FD');
    doc.setFontSize(5);
    doc.setFont(FONT, 'bold');
    doc.setTextColor(...C.black);
    doc.text(wallLabel, lp.x, lp.y + 1.5, { align: 'center' });

    // Segment dimension lines
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = toXY(wall.points[i].lng, wall.points[i].lat, bbox, a);
      const p2 = toXY(wall.points[i + 1].lng, wall.points[i + 1].lat, bbox, a);
      const segLen = calculateDistance(wall.points[i], wall.points[i + 1]);
      drawDimensionLine(doc, p1.x, p1.y, p2.x, p2.y, segLen * 1000, 'mm', -8);
    }

    // Total wall length dimension
    if (wall.points.length > 2) {
      const first = toXY(wall.points[0].lng, wall.points[0].lat, bbox, a);
      const last = toXY(wall.points[wall.points.length - 1].lng, wall.points[wall.points.length - 1].lat, bbox, a);
      const totalLen = wall.length;
      drawDimensionLine(doc, first.x, first.y, last.x, last.y, totalLen * 1000, 'mm', -14);
    }
  });
}

// ─── DIMENSION LINE (CAD-style with arrows) ───────────────
function drawDimensionLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, value: number, _unit: string, offset: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return;

  const nx = (-dy / len) * offset;
  const ny = (dx / len) * offset;

  const ox1 = x1 + nx, oy1 = y1 + ny;
  const ox2 = x2 + nx, oy2 = y2 + ny;

  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.12);

  // Extension lines
  doc.line(x1, y1, ox1, oy1);
  doc.line(x2, y2, ox2, oy2);

  // Dimension line
  doc.line(ox1, oy1, ox2, oy2);

  // Arrowheads (small ticks at 45°)
  const adx = dx / len * 1.2;
  const ady = dy / len * 1.2;
  const andx = (-dy / len) * 0.5;
  const andy = (dx / len) * 0.5;
  doc.line(ox1 - andx, oy1 - andy, ox1 + adx + andx, oy1 + ady + andy);
  doc.line(ox2 + andx, oy2 + andy, ox2 - adx - andx, oy2 - ady - andy);

  // Dimension text
  const mx = (ox1 + ox2) / 2;
  const my = (oy1 + oy2) / 2;
  const dimText = Math.round(value).toString();

  doc.setFillColor(...C.white);
  const tw = doc.getTextWidth(dimText) + 2;
  doc.rect(mx - tw / 2, my - 2, tw, 3, 'F');

  doc.setFontSize(4.5);
  doc.setFont(FONT, 'normal');
  doc.setTextColor(...C.black);
  doc.text(dimText, mx, my, { align: 'center' });
}

// ─── ELEVATION VIEW ───────────────────────────────────────
function drawElevation(
  doc: jsPDF,
  wall: WallSegment,
  ox: number,
  baseY: number,
  availW: number,
  elevIdx: number,
  sheetIdx: number
) {
  // At 1:200, 1mm paper = 0.2m real
  // But for elevations we may need to use different scale for visibility
  const wallLen = wall.length || 3;
  const maxH = wall.maxHeight || 1;

  // Use available width to determine scale
  const hScale = Math.min(availW * 0.7 / wallLen, 5); // mm per metre
  const vScale = hScale; // keep 1:1 aspect for proper scale

  const wW = wallLen * hScale;
  const wH = maxH * vScale;
  const footH = Math.max(0.2 * vScale, 2);

  const groundY = baseY;

  // ── Ground line with hatch ──
  const gExtL = 8, gExtR = 15;
  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.4);
  doc.line(ox - gExtL, groundY, ox + wW + gExtR, groundY);

  // Ground hatch (zigzag below line)
  doc.setLineWidth(0.12);
  for (let gx = ox - gExtL; gx < ox + wW + gExtR; gx += 2) {
    doc.line(gx, groundY, gx - 1.2, groundY + 1.5);
  }

  // ── Wall outline ──
  doc.setLineWidth(0.4);
  doc.setDrawColor(...C.black);

  if (wall.wallType === 'concrete-sleeper' || wall.wallType === 'timber') {
    // Show sleeper/timber courses
    const courseH = 0.2 * vScale; // 200mm courses
    const numCourses = Math.max(1, Math.round(wH / courseH));
    const actualCH = wH / numCourses;
    for (let c = 0; c < numCourses; c++) {
      const cy = groundY - (c + 1) * actualCH;
      doc.setLineWidth(0.3);
      doc.rect(ox, cy, wW, actualCH);
    }
    // Steel posts for sleeper
    if (wall.wallType === 'concrete-sleeper') {
      const postSpacing = Math.min(2.4 * hScale, wW / 2);
      doc.setLineWidth(0.2);
      for (let px = ox; px <= ox + wW; px += postSpacing) {
        doc.line(px, groundY, px, groundY - wH);
      }
    }
  } else {
    // Simple rectangular outline
    doc.rect(ox, groundY - wH, wW, wH);
    // Cross hatch for concrete
    if (wall.wallType === 'reinforced-concrete' || wall.wallType === 'reinforced-masonry') {
      doc.setLineWidth(0.08);
      const step = Math.max(2, wH / 8);
      for (let hy = groundY - wH; hy < groundY; hy += step) {
        doc.line(ox, hy, Math.min(ox + wW, ox + step * 2), Math.min(hy + step, groundY));
      }
    }
  }

  // ── Footing ──
  const fExtend = Math.max(1.5 * hScale, 3);
  doc.setLineWidth(0.3);
  doc.rect(ox - fExtend / 2, groundY, wW + fExtend, footH);

  // ── Wall label box (centred below wall) ──
  const wallLabel = wall.name.replace('Wall ', 'RW');
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.black);
  doc.setLineWidth(0.3);
  const lblW = 14;
  const lblH = 5;
  const lblX = ox + wW / 2 - lblW / 2;
  const lblY = groundY - wH / 2 - lblH / 2;
  doc.rect(lblX, lblY, lblW, lblH, 'FD');
  doc.setFontSize(5);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(...C.black);
  doc.text(wallLabel, ox + wW / 2, lblY + 3.5, { align: 'center' });

  // ── Height dimension (left side) ──
  const dimX = ox - gExtL - 4;
  doc.setLineWidth(0.15);
  doc.setDrawColor(...C.black);
  // Vertical line
  doc.line(dimX, groundY, dimX, groundY - wH);
  // Extension lines
  doc.line(dimX - 1, groundY, ox - 1, groundY);
  doc.line(dimX - 1, groundY - wH, ox - 1, groundY - wH);
  // Arrows
  doc.setFillColor(...C.black);
  doc.triangle(dimX, groundY, dimX - 0.5, groundY - 1, dimX + 0.5, groundY - 1, 'F');
  doc.triangle(dimX, groundY - wH, dimX - 0.5, groundY - wH + 1, dimX + 0.5, groundY - wH + 1, 'F');
  // Height text (vertical)
  const htMM = Math.round(maxH * 1000);
  doc.setFontSize(5);
  doc.setFont(FONT, 'normal');
  doc.text(htMM.toString(), dimX - 2, groundY - wH / 2 + 1, { angle: 90 });

  // ── Length dimension (top) ──
  const topDimY = groundY - wH - 6;
  doc.setLineWidth(0.15);
  doc.line(ox, topDimY, ox + wW, topDimY);
  doc.line(ox, topDimY - 1, ox, groundY - wH);
  doc.line(ox + wW, topDimY - 1, ox + wW, groundY - wH);
  // Arrows
  doc.triangle(ox, topDimY, ox + 1, topDimY - 0.5, ox + 1, topDimY + 0.5, 'F');
  doc.triangle(ox + wW, topDimY, ox + wW - 1, topDimY - 0.5, ox + wW - 1, topDimY + 0.5, 'F');
  // Length text
  const lenMM = Math.round(wallLen * 1000);
  doc.setFontSize(5);
  doc.text(lenMM.toString(), ox + wW / 2, topDimY - 2, { align: 'center' });

  // ── Node-to-node dimensions if multiple segments ──
  if (wall.points.length > 2) {
    let cumLen = 0;
    for (let i = 0; i < wall.points.length - 1; i++) {
      const segLen = calculateDistance(wall.points[i], wall.points[i + 1]);
      const sx1 = ox + cumLen * hScale;
      const sx2 = ox + (cumLen + segLen) * hScale;
      // Tick marks
      doc.setLineWidth(0.1);
      doc.line(sx1, groundY - wH, sx1, groundY - wH - 3);
      doc.line(sx2, groundY - wH, sx2, groundY - wH - 3);
      cumLen += segLen;
    }
  }

  // ── Per-node heights along the wall ──
  {
    let cumLen = 0;
    wall.points.forEach((p, i) => {
      const ht = p.height ?? 0;
      if (ht > 0 && i < wall.points.length) {
        const px = ox + cumLen * hScale;
        const hPx = ht * vScale;
        // Dashed line from ground to height
        doc.setLineWidth(0.1);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(px, groundY, px, groundY - hPx);
        doc.setLineDashPattern([], 0);
      }
      if (i < wall.points.length - 1) {
        cumLen += calculateDistance(wall.points[i], wall.points[i + 1]);
      }
    });
  }

  // ── Fence above ──
  if (wall.hasFenceAbove) {
    const fenceH = Math.min(1.5 * vScale, 15);
    doc.setDrawColor(...C.black);
    doc.setLineWidth(0.25);
    // Posts
    const numPosts = Math.max(2, Math.ceil(wW / 10));
    const postSpacing = wW / (numPosts - 1);
    for (let i = 0; i < numPosts; i++) {
      const fx = ox + i * postSpacing;
      doc.line(fx, groundY - wH, fx, groundY - wH - fenceH);
    }
    // Top rail
    doc.line(ox, groundY - wH - fenceH, ox + wW, groundY - wH - fenceH);
    // Middle rail
    doc.line(ox, groundY - wH - fenceH * 0.5, ox + wW, groundY - wH - fenceH * 0.5);

    // Fence height dimension
    const fDimX = ox + wW + 5;
    doc.setLineWidth(0.12);
    doc.line(fDimX, groundY - wH, fDimX, groundY - wH - fenceH);
    doc.line(fDimX - 1, groundY - wH, ox + wW + 1, groundY - wH);
    doc.line(fDimX - 1, groundY - wH - fenceH, ox + wW + 1, groundY - wH - fenceH);
    doc.setFillColor(...C.black);
    doc.triangle(fDimX, groundY - wH, fDimX - 0.4, groundY - wH - 0.8, fDimX + 0.4, groundY - wH - 0.8, 'F');
    doc.triangle(fDimX, groundY - wH - fenceH, fDimX - 0.4, groundY - wH - fenceH + 0.8, fDimX + 0.4, groundY - wH - fenceH + 0.8, 'F');
    doc.setFontSize(4);
    doc.text('1500', fDimX + 1, groundY - wH - fenceH / 2 + 1);
  }

  // ── Elevation label with circle ──
  const elevLabelY = groundY + footH + 10;
  const labelLetter = String.fromCharCode(65 + elevIdx); // A, B, C...
  doc.setFontSize(10);
  doc.setFont(FONT, 'bold');
  doc.text(`ELEVATION`, ox + wW / 2 - 18, elevLabelY);

  // Circle with letter and sheet number
  const circX = ox + wW / 2 + 12;
  const circR = 5;
  doc.setLineWidth(0.4);
  doc.setDrawColor(...C.black);
  doc.circle(circX, elevLabelY - 3, circR, 'S');
  // Horizontal line through circle
  doc.line(circX - circR, elevLabelY - 3, circX + circR, elevLabelY - 3);
  doc.setFontSize(7);
  doc.text(labelLetter, circX - 1.5, elevLabelY - 5);
  doc.text(sheetIdx.toString(), circX - 1.5, elevLabelY - 0.5);

  // Scale note
  doc.setFontSize(5);
  doc.setFont(FONT, 'normal');
  doc.text(`SCALE 1:200`, ox + wW / 2 - 18, elevLabelY + 4);

  return wH + footH + 25;
}

// ─── MAIN EXPORT FUNCTION ─────────────────────────────────
export async function generateEngineeringSitePlan(project: ProjectState, googleMapsApiKey?: string, branding?: BrandingConfig) {
  const doc = new jsPDF('landscape', 'mm', 'a3');

  // Load logo
  const logoDataUrl = await loadLogoDataUrl();

  const drawingAreaW = A3_W - BORDER_INNER * 2 - TB_WIDTH;
  const drawingAreaH = A3_H - BORDER_INNER * 2;
  const totalSheets = 1 + (project.walls.length > 0 ? 1 : 0);
  const drawingNoBase = `OB-${project.details.clientName?.replace(/\s+/g, '').substring(0, 6).toUpperCase() || 'XXXXX'}`;

  // ═══ PAGE 1: SITE PLAN ═══════════════════════════════════
  drawBorder(doc);

  if (project.walls.length > 0 && project.walls.some(w => w.points.length >= 2)) {
    const planArea: DrawArea = {
      x: BORDER_INNER + 5,
      y: BORDER_INNER + 5,
      w: drawingAreaW - 10,
      h: drawingAreaH - 10,
    };

    // Compute 1:200 bbox
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
      } catch { /* proceed without satellite */ }
    }

    // Walls with height circles
    drawWallsOnPlan(doc, project.walls, bbox, planArea);

    // North arrow (top-left of drawing area)
    drawNorthArrow(doc, BORDER_INNER + 20, BORDER_INNER + 22);

    // Legend (top-right of drawing area, left of title block)
    const legendX = A3_W - BORDER_INNER - TB_WIDTH - 165;
    drawLegend(doc, legendX, BORDER_INNER + 10);

    // Note boxes
    drawNoteBoxes(doc, legendX, BORDER_INNER + 60);

    // Scale label
    doc.setFontSize(10);
    doc.setFont(FONT, 'bold');
    doc.setTextColor(...C.black);
    const scaleLabelX = BORDER_INNER + 30;
    const scaleLabelY = A3_H - BORDER_INNER - 10;
    doc.text('SITE PLAN', scaleLabelX, scaleLabelY);
    doc.setFontSize(6);
    doc.setFont(FONT, 'normal');
    doc.text('SCALE 1:200', scaleLabelX, scaleLabelY + 5);

    // Note about heights
    doc.setFontSize(5);
    doc.setFont(FONT, 'normal');
    const noteX = legendX;
    let noteY = BORDER_INNER + 95;
    doc.rect(noteX, noteY, 160, 6);
    doc.text('NOTE: HEIGHTS OF RETAINING WALLS TO', noteX + 2, noteY + 4);
    noteY += 6;
    doc.rect(noteX, noteY, 160, 6);
    doc.text('BE CONFIRMED ON SITE BY CONTRACTOR', noteX + 2, noteY + 4);

  } else {
    doc.setFontSize(11);
    doc.setFont(FONT, 'italic');
    doc.setTextColor(160, 160, 160);
    doc.text('No wall segments drawn — plan view unavailable', A3_W / 2 - 55, A3_H / 2);
  }

  drawTitleBlock(doc, project, branding, logoDataUrl, {
    drawingTitle: 'SITE PLAN',
    scale: '1: 200',
    sheetNum: 1,
    totalSheets,
    drawingNo: `${drawingNoBase}-1`,
  });

  // ═══ PAGE 2: ELEVATIONS ══════════════════════════════════
  if (project.walls.length > 0) {
    doc.addPage([420, 297], 'landscape');
    drawBorder(doc);

    // Note boxes at top right
    const noteX = A3_W - BORDER_INNER - TB_WIDTH - 165;
    doc.setLineWidth(0.3);
    doc.setDrawColor(...C.black);
    doc.rect(noteX, BORDER_INNER + 5, 160, 10);
    doc.setFontSize(5);
    doc.setFont(FONT, 'normal');
    doc.setTextColor(...C.text);
    doc.text('NOTE: THIS DRAWING SHALL BE READ IN', noteX + 2, BORDER_INNER + 9);
    doc.text('CONJUNCTION WITH THE ATTACHED', noteX + 2, BORDER_INNER + 13);

    doc.rect(noteX, BORDER_INNER + 17, 160, 10);
    doc.text('NOTE: HEIGHTS OF RETAINING WALLS TO', noteX + 2, BORDER_INNER + 21);
    doc.text('BE CONFIRMED ON SITE BY CONTRACTOR', noteX + 2, BORDER_INNER + 25);

    // Draw elevations stacked vertically
    const elevAvailW = drawingAreaW - 20;
    let curY = BORDER_INNER + 40;
    const elevSpacing = (drawingAreaH - 50) / Math.max(project.walls.length, 1);

    project.walls.forEach((wall, idx) => {
      const baseY = curY + Math.min(elevSpacing * 0.7, 80);
      drawElevation(doc, wall, BORDER_INNER + 30, baseY, elevAvailW, idx, 1);
      curY += elevSpacing;
    });

    drawTitleBlock(doc, project, branding, logoDataUrl, {
      drawingTitle: 'ELEVATIONS',
      scale: '1: 200',
      sheetNum: 2,
      totalSheets,
      drawingNo: `${drawingNoBase}-2`,
    });
  }

  doc.save(`concept-site-plan-${project.details.clientName?.replace(/\s+/g, '-') || 'export'}.pdf`);
}
