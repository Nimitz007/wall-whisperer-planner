import { useCallback } from 'react';
import jsPDF from 'jspdf';
import { ProjectState, WALL_TYPE_LABELS } from '@/lib/types';
import { getTotalWallLength, estimateMaterials } from '@/lib/wallCalculations';
import { generateEngineeringSitePlan } from '@/lib/pdfSitePlan';
import { Button } from '@/components/ui/button';
import { FileText, Table, Download } from 'lucide-react';

interface ExportGeneratorProps {
  project: ProjectState;
  mapboxToken?: string;
}

const ExportGenerator = ({ project, mapboxToken }: ExportGeneratorProps) => {
  const generatePDFSitePlan = useCallback(() => {
    generateEngineeringSitePlan(project, mapboxToken);
  }, [project, mapboxToken]);

  const generatePDFSummary = useCallback(() => {
    const doc = new jsPDF('portrait', 'mm', 'a4');
    const w = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(45, 55, 72);
    doc.rect(0, 0, w, 24, 'F');
    doc.setTextColor(255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PROJECT SUMMARY — CONCEPT RETAINING WALL', 15, 14);

    let y = 36;
    doc.setTextColor(30);

    // Details
    const addSection = (title: string) => {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 15, y);
      y += 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
    };

    addSection('Client & Project');
    doc.text(`Client: ${project.details.clientName || 'N/A'}`, 15, y); y += 5;
    doc.text(`Address: ${project.details.address || 'N/A'}`, 15, y); y += 5;
    doc.text(`Email: ${project.details.clientEmail || 'N/A'}`, 15, y); y += 5;
    doc.text(`Phone: ${project.details.clientPhone || 'N/A'}`, 15, y); y += 5;
    doc.text(`Reference: ${project.details.projectReference || 'N/A'}`, 15, y); y += 5;
    doc.text(`Date: ${new Date().toLocaleDateString('en-AU')}`, 15, y); y += 10;

    addSection('Wall Summary');
    doc.text(`Total Segments: ${project.walls.length}`, 15, y); y += 5;
    doc.text(`Total Length: ${getTotalWallLength(project.walls).toFixed(1)}m`, 15, y); y += 8;

    project.walls.forEach(wall => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${wall.name} — ${WALL_TYPE_LABELS[wall.wallType]}`, 15, y); y += 5;
      doc.setFont('helvetica', 'normal');
      doc.text(`Length: ${wall.length.toFixed(1)}m | Avg Height: ${wall.averageHeight}m | Max Height: ${wall.maxHeight}m`, 20, y); y += 5;
      doc.text(`Offset from dwelling: ${wall.offsetFromDwelling}m (approx) | Offset from boundary: ${wall.offsetFromBoundary}m (approx)`, 20, y); y += 5;
      doc.text(`Surcharge: ${wall.hasSurcharge ? 'Yes' : 'No'} | Fence above: ${wall.hasFenceAbove ? 'Yes' : 'No'} | Drainage: ${wall.hasDrainageRequired ? 'Yes' : 'No'}`, 20, y); y += 5;
      if (wall.notes) { doc.text(`Notes: ${wall.notes}`, 20, y); y += 5; }
      y += 3;

      // Materials
      const materials = estimateMaterials(wall);
      materials.forEach(m => {
        doc.text(`  • ${m.item}: ${m.quantity} ${m.unit} ${m.notes ? `(${m.notes})` : ''}`, 20, y);
        y += 4;
      });
      y += 4;

      if (y > 260) { doc.addPage(); y = 20; }
    });

    // Site context
    if (project.siteContext.slopeNotes || project.siteContext.comments) {
      addSection('Site Context Notes');
      if (project.siteContext.slopeNotes) { doc.text(`Slope: ${project.siteContext.slopeNotes}`, 15, y); y += 5; }
      if (project.siteContext.accessNotes) { doc.text(`Access: ${project.siteContext.accessNotes}`, 15, y); y += 5; }
      if (project.siteContext.adjoiningStructures) { doc.text(`Adjoining: ${project.siteContext.adjoiningStructures}`, 15, y); y += 5; }
      if (project.siteContext.comments) { doc.text(`Comments: ${project.siteContext.comments}`, 15, y); y += 5; }
    }

    // Disclaimer page
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('IMPORTANT DISCLAIMER', 15, 30);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const disclaimer = [
      'This document provides preliminary concept planning information only.',
      'Measurements and outputs are approximate unless verified by survey.',
      'Outputs are not certified engineering drawings.',
      'This document is not for construction or council approval.',
      'Formal engineering design and certification are required before construction.',
      '',
      '© Simple Engineers — Concept Planning Tool',
    ];
    let dy = 42;
    disclaimer.forEach(line => { doc.text(line, 15, dy); dy += 7; });

    doc.save(`project-summary-${project.details.projectReference || 'export'}.pdf`);
  }, [project]);

  const generateCSV = useCallback(() => {
    const headers = ['Segment Name', 'Wall Type', 'Length (m)', 'Avg Height (m)', 'Max Height (m)', 'Offset Dwelling (m)', 'Offset Boundary (m)', 'Surcharge', 'Fence Above', 'Drainage', 'Notes'];
    const rows = project.walls.map(w => [
      w.name, WALL_TYPE_LABELS[w.wallType], w.length.toFixed(1), w.averageHeight.toString(), w.maxHeight.toString(),
      w.offsetFromDwelling.toString(), w.offsetFromBoundary.toString(),
      w.hasSurcharge ? 'Yes' : 'No', w.hasFenceAbove ? 'Yes' : 'No', w.hasDrainageRequired ? 'Yes' : 'No', w.notes,
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wall-schedule-${project.details.projectReference || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project]);

  return (
    <div className="space-y-3">
      <Button onClick={generatePDFSitePlan} className="w-full justify-start gap-3 rounded-xl" variant="outline" size="lg">
        <FileText className="h-4 w-4 text-primary" />
        <div className="text-left">
          <p className="text-sm font-semibold">Concept Site Plan (PDF)</p>
          <p className="text-xs text-muted-foreground">A3 landscape with wall layout and schedule</p>
        </div>
        <Download className="ml-auto h-4 w-4" />
      </Button>

      <Button onClick={generatePDFSummary} className="w-full justify-start gap-3 rounded-xl" variant="outline" size="lg">
        <FileText className="h-4 w-4 text-primary" />
        <div className="text-left">
          <p className="text-sm font-semibold">Project Summary (PDF)</p>
          <p className="text-xs text-muted-foreground">Full details, materials, and disclaimer</p>
        </div>
        <Download className="ml-auto h-4 w-4" />
      </Button>

      <Button onClick={generateCSV} className="w-full justify-start gap-3 rounded-xl" variant="outline" size="lg">
        <Table className="h-4 w-4 text-primary" />
        <div className="text-left">
          <p className="text-sm font-semibold">Wall Schedule (CSV)</p>
          <p className="text-xs text-muted-foreground">Spreadsheet export of all wall data</p>
        </div>
        <Download className="ml-auto h-4 w-4" />
      </Button>
    </div>
  );
};

export default ExportGenerator;
