import { useCallback, useState } from 'react';
import jsPDF from 'jspdf';
import { ProjectState, WALL_TYPE_LABELS } from '@/lib/types';
import { getTotalWallLength, estimateMaterials } from '@/lib/wallCalculations';
import { generateEngineeringSitePlan } from '@/lib/pdfSitePlan';
import { Button } from '@/components/ui/button';
import { FileText, Table, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBranding } from '@/contexts/BrandingContext';

interface ExportGeneratorProps {
  project: ProjectState;
  googleMapsApiKey?: string;
}

const ExportGenerator = ({ project, googleMapsApiKey }: ExportGeneratorProps) => {
  const branding = useBranding();
  const [loadingSitePlan, setLoadingSitePlan] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingCSV, setLoadingCSV] = useState(false);

  const generatePDFSitePlan = useCallback(async () => {
    setLoadingSitePlan(true);
    toast.loading('Generating site plan...', { id: 'site-plan' });
    try {
      await generateEngineeringSitePlan(project, googleMapsApiKey, branding);
      toast.success('Site plan downloaded', { id: 'site-plan', description: 'A3 landscape PDF with wall layout' });
    } catch {
      toast.error('Failed to generate site plan', { id: 'site-plan' });
    } finally {
      setLoadingSitePlan(false);
    }
  }, [project, googleMapsApiKey, branding]);

  const generatePDFSummary = useCallback(() => {
    setLoadingSummary(true);
    toast.loading('Generating summary...', { id: 'summary' });
    try {
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();

      // Watermark helper
      const addWatermark = () => {
        doc.saveGraphicsState();
        doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
        doc.setFontSize(54);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('SIMPLE ENGINEERS', w / 2, h / 2, { align: 'center', angle: 35 });
        doc.restoreGraphicsState();
      };

      addWatermark();

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
      if (project.details.isBuilder) { doc.text(`Company: ${project.details.companyName || 'N/A'}`, 15, y); y += 5; }
      doc.text(`Date: ${new Date().toLocaleDateString('en-AU')}`, 15, y); y += 10;

      addSection('Wall Summary');
      doc.text(`Total Segments: ${project.walls.length}`, 15, y); y += 5;
      doc.text(`Total Length: ${getTotalWallLength(project.walls).toFixed(1)}m`, 15, y); y += 8;

      project.walls.forEach(wall => {
        doc.setFont('helvetica', 'bold');
        doc.text(`${wall.name} — ${WALL_TYPE_LABELS[wall.wallType]}`, 15, y); y += 5;
        doc.setFont('helvetica', 'normal');
        doc.text(`Length: ${wall.length.toFixed(1)}m | Min Height: ${wall.minHeight}m | Max Height: ${wall.maxHeight}m`, 20, y); y += 5;
        doc.text(`Offset from dwelling: ${wall.offsetFromDwelling}m (approx) | Offset from boundary: ${wall.offsetFromBoundary}m (approx)`, 20, y); y += 5;
        doc.text(`Surcharge: ${wall.hasSurcharge ? 'Yes' : 'No'} | Fence above: ${wall.hasFenceAbove ? 'Yes' : 'No'} | Drainage: ${wall.hasDrainageRequired ? 'Yes' : 'No'}`, 20, y); y += 5;
        if (wall.notes) { doc.text(`Notes: ${wall.notes}`, 20, y); y += 5; }
        y += 3;

        // Materials
        const materials = estimateMaterials(wall);
        materials.forEach(m => {
          doc.text(`  • ${m.item}: ${m.qtyWithWastage} ${m.unit} (incl. ${m.wastagePercent}% wastage)`, 20, y);
          y += 4;
        });
        y += 4;

        if (y > 260) { doc.addPage(); addWatermark(); y = 20; }
      });

      // Disclaimer page
      doc.addPage();
      addWatermark();
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
        `© ${branding.companyName} — Concept Planning Tool`,
      ];
      let dy = 42;
      disclaimer.forEach(line => { doc.text(line, 15, dy); dy += 7; });

      doc.save(`project-summary-${project.details.clientName?.replace(/\s+/g, '-') || 'export'}.pdf`);
      toast.success('Summary downloaded', { id: 'summary', description: 'Project summary PDF' });
    } catch {
      toast.error('Failed to generate summary', { id: 'summary' });
    } finally {
      setLoadingSummary(false);
    }
  }, [project]);

  const generateCSV = useCallback(() => {
    setLoadingCSV(true);
    try {
      const headers = ['Segment Name', 'Wall Type', 'Length (m)', 'Min Height (m)', 'Max Height (m)', 'Offset Dwelling (m)', 'Offset Boundary (m)', 'Surcharge', 'Fence Above', 'Drainage', 'Notes'];
      const rows = project.walls.map(w => [
        w.name, WALL_TYPE_LABELS[w.wallType], w.length.toFixed(1), w.minHeight.toString(), w.maxHeight.toString(),
        w.offsetFromDwelling.toString(), w.offsetFromBoundary.toString(),
        w.hasSurcharge ? 'Yes' : 'No', w.hasFenceAbove ? 'Yes' : 'No', w.hasDrainageRequired ? 'Yes' : 'No', w.notes,
      ]);

      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wall-schedule-${project.details.clientName?.replace(/\s+/g, '-') || 'export'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded', { description: 'Wall schedule spreadsheet' });
    } catch {
      toast.error('Failed to generate CSV');
    } finally {
      setLoadingCSV(false);
    }
  }, [project]);

  return (
    <div className="space-y-3">
      <Button
        onClick={generatePDFSitePlan}
        disabled={loadingSitePlan}
        className="w-full justify-between rounded-xl"
        variant="outline"
        size="lg"
      >
        <div className="flex items-center gap-3">
          {loadingSitePlan ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <FileText className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm font-semibold">{loadingSitePlan ? 'Generating...' : 'Concept Site Plan (PDF)'}</span>
        </div>
        {!loadingSitePlan && <Download className="h-4 w-4" />}
      </Button>

      <Button
        onClick={generatePDFSummary}
        disabled={loadingSummary}
        className="w-full justify-between rounded-xl"
        variant="outline"
        size="lg"
      >
        <div className="flex items-center gap-3">
          {loadingSummary ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <FileText className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm font-semibold">{loadingSummary ? 'Generating...' : 'Project Summary (PDF)'}</span>
        </div>
        {!loadingSummary && <Download className="h-4 w-4" />}
      </Button>

      <Button
        onClick={generateCSV}
        disabled={loadingCSV}
        className="w-full justify-between rounded-xl"
        variant="outline"
        size="lg"
      >
        <div className="flex items-center gap-3">
          {loadingCSV ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Table className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm font-semibold">{loadingCSV ? 'Generating...' : 'Wall Schedule (CSV)'}</span>
        </div>
        {!loadingCSV && <Download className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export default ExportGenerator;
