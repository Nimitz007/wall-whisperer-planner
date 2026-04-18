import jsPDF from 'jspdf';

/**
 * Draws a small icon (~10x10mm) for a material item using vector primitives.
 * Keeps the PDF lightweight (no embedded raster icons) and consistent.
 */
export function drawMaterialIcon(doc: jsPDF, key: string | undefined, x: number, y: number, size = 10) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  doc.setLineWidth(0.25);
  doc.setDrawColor(60, 60, 60);

  switch (key) {
    case 'sleeper': {
      // Stacked horizontal sleepers
      doc.setFillColor(180, 180, 180);
      for (let i = 0; i < 3; i++) {
        doc.rect(x + 0.8, y + 1.2 + i * 2.8, size - 1.6, 2.2, 'FD');
      }
      return;
    }
    case 'i-beam': {
      // I-beam cross section
      doc.setFillColor(120, 120, 120);
      doc.rect(x + 1.5, y + 1, size - 3, 1.4, 'F'); // top flange
      doc.rect(cx - 0.7, y + 1, 1.4, size - 2, 'F'); // web
      doc.rect(x + 1.5, y + size - 2.4, size - 3, 1.4, 'F'); // bottom flange
      return;
    }
    case 'ag-pipe': {
      // Slotted pipe - circle with slots
      doc.setFillColor(60, 60, 60);
      doc.circle(cx, cy, size / 2 - 1, 'S');
      doc.circle(cx, cy, size / 2 - 2.4, 'S');
      // slots
      doc.setLineWidth(0.4);
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const r1 = size / 2 - 2.2;
        const r2 = size / 2 - 1.2;
        doc.line(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      }
      return;
    }
    case 'concrete': {
      // Concrete block with aggregate dots
      doc.setFillColor(200, 200, 200);
      doc.rect(x + 0.8, y + 0.8, size - 1.6, size - 1.6, 'FD');
      doc.setFillColor(110, 110, 110);
      const dots = [[2, 2.5], [5, 3.5], [3.5, 6], [6.5, 6.5], [7.5, 2.5]];
      dots.forEach(([dx, dy]) => doc.circle(x + dx, y + dy, 0.45, 'F'));
      return;
    }
    case 'aggregate': {
      // Pile of stones
      doc.setFillColor(140, 140, 140);
      doc.circle(x + 3, y + size - 2, 1.6, 'FD');
      doc.circle(x + 6, y + size - 2.2, 1.8, 'FD');
      doc.circle(x + 4.5, y + size - 4, 1.5, 'FD');
      doc.circle(x + 7, y + size - 4.5, 1.2, 'FD');
      return;
    }
    case 'geofabric': {
      // Roll of fabric
      doc.setFillColor(220, 215, 180);
      doc.roundedRect(x + 0.8, y + 2, size - 1.6, size - 4, 1, 1, 'FD');
      doc.line(x + 0.8, y + 4, x + size - 0.8, y + 4);
      doc.line(x + 0.8, y + 6, x + size - 0.8, y + 6);
      return;
    }
    case 'rebar': {
      // Deformed bar - diagonal ribs on rod
      doc.setFillColor(160, 100, 60);
      doc.roundedRect(x + 0.6, cy - 1.2, size - 1.2, 2.4, 1.2, 1.2, 'FD');
      doc.setLineWidth(0.3);
      for (let i = 1; i < 6; i++) {
        const px = x + 1 + i * 1.4;
        doc.line(px, cy - 1.2, px + 0.6, cy + 1.2);
      }
      return;
    }
    case 'block': {
      // Hollow masonry block
      doc.setFillColor(210, 210, 200);
      doc.rect(x + 0.8, y + 1.5, size - 1.6, size - 3, 'FD');
      doc.setFillColor(255, 255, 255);
      doc.rect(x + 2, y + 2.6, 2.2, size - 5.2, 'FD');
      doc.rect(x + size - 4.2, y + 2.6, 2.2, size - 5.2, 'FD');
      return;
    }
    case 'timber': {
      // Wood plank with grain
      doc.setFillColor(190, 145, 95);
      doc.rect(x + 0.8, y + 1.5, size - 1.6, size - 3, 'FD');
      doc.setLineWidth(0.2);
      doc.setDrawColor(120, 80, 40);
      for (let i = 0; i < 3; i++) {
        doc.line(x + 1.2, y + 3 + i * 1.6, x + size - 1.2, y + 3 + i * 1.6);
      }
      return;
    }
    case 'bolt': {
      // Hex bolt side
      doc.setFillColor(140, 140, 140);
      doc.rect(x + 1, cy - 1.6, 3, 3.2, 'FD'); // head
      doc.rect(x + 4, cy - 0.8, size - 5, 1.6, 'FD'); // shaft
      // threads
      doc.setLineWidth(0.2);
      for (let i = 0; i < 4; i++) {
        doc.line(x + 5 + i * 1, cy - 0.8, x + 5 + i * 1, cy + 0.8);
      }
      return;
    }
    case 'gabion': {
      // Wire mesh basket
      doc.setFillColor(170, 170, 170);
      doc.rect(x + 0.8, y + 1.5, size - 1.6, size - 3, 'FD');
      doc.setLineWidth(0.2);
      for (let i = 1; i < 4; i++) doc.line(x + 0.8 + i * 2, y + 1.5, x + 0.8 + i * 2, y + size - 1.5);
      for (let i = 1; i < 3; i++) doc.line(x + 0.8, y + 1.5 + i * 2, x + size - 0.8, y + 1.5 + i * 2);
      return;
    }
    case 'formwork': {
      // Plywood sheet with frame
      doc.setFillColor(225, 200, 150);
      doc.rect(x + 0.8, y + 1.2, size - 1.6, size - 2.4, 'FD');
      doc.setLineWidth(0.4);
      doc.rect(x + 1.6, y + 2, size - 3.2, size - 4, 'S');
      return;
    }
    case 'backfill': {
      // Soil mound
      doc.setFillColor(140, 100, 70);
      doc.triangle(x + 0.8, y + size - 1, cx, y + 2, x + size - 0.8, y + size - 1, 'FD');
      doc.setFillColor(90, 70, 50);
      doc.circle(x + 3, y + size - 2.2, 0.5, 'F');
      doc.circle(x + 6, y + size - 2.5, 0.4, 'F');
      return;
    }
    default: {
      doc.setFillColor(230, 230, 230);
      doc.rect(x + 0.8, y + 0.8, size - 1.6, size - 1.6, 'FD');
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text('?', cx, cy + 1, { align: 'center' });
      return;
    }
  }
}
