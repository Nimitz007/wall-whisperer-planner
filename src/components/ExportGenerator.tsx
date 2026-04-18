import { useCallback, useState } from 'react';
import jsPDF from 'jspdf';
import { ProjectState, WALL_TYPE_LABELS } from '@/lib/types';
import { getTotalWallLength, estimateMaterials } from '@/lib/wallCalculations';
import { generateEngineeringSitePlan } from '@/lib/pdfSitePlan';
import { uploadSubmissionFile } from '@/lib/submissionFiles';
import { drawMaterialIcon } from '@/lib/materialIcons';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBranding } from '@/contexts/BrandingContext';

const fmt = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
      const result = await generateEngineeringSitePlan(project, googleMapsApiKey, branding, { returnBlob: true });
      if (result) {
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url; a.download = result.filename; a.click();
        URL.revokeObjectURL(url);
        uploadSubmissionFile(result.filename, result.blob, 'application/pdf').catch(() => {});
      }
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
      const clientLabel = project.details.isBuilder ? 'Builder' : 'Client';
      const clientDisplay = project.details.isBuilder && project.details.companyName
        ? project.details.companyName
        : project.details.clientName;
      doc.text(`${clientLabel}: ${clientDisplay || 'N/A'}`, 15, y); y += 5;
      if (project.details.isBuilder && project.details.clientName) {
        doc.text(`Contact: ${project.details.clientName}`, 15, y); y += 5;
      }
      doc.text(`Address: ${project.details.address || 'N/A'}`, 15, y); y += 5;
      doc.text(`Email: ${project.details.clientEmail || 'N/A'}`, 15, y); y += 5;
      doc.text(`Phone: ${project.details.clientPhone || 'N/A'}`, 15, y); y += 5;
      doc.text(`Date: ${new Date().toLocaleDateString('en-AU')}`, 15, y); y += 10;

      addSection('Wall Summary');
      doc.text(`Total Segments: ${project.walls.length}`, 15, y); y += 5;
      doc.text(`Total Length: ${getTotalWallLength(project.walls).toFixed(1)}m`, 15, y); y += 8;

      let grandTotal = 0;
      const colX = { icon: 18, item: 32, qty: 118, unit: 138, unitPrice: 168, total: 195 };
      const rightMargin = w - 15;
      const rowH = 11;

      const drawTableHeader = () => {
        doc.setFillColor(235, 238, 242);
        doc.rect(15, y, rightMargin - 15, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(40);
        doc.text('Item', colX.item, y + 4.8);
        doc.text('Qty', colX.qty, y + 4.8, { align: 'right' });
        doc.text('Unit', colX.unit, y + 4.8);
        doc.text('Unit Price', colX.unitPrice, y + 4.8, { align: 'right' });
        doc.text('Total', colX.total, y + 4.8, { align: 'right' });
        y += 9;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
      };

      const ensureSpace = (needed: number) => {
        if (y + needed > 275) {
          doc.addPage();
          addWatermark();
          y = 20;
        }
      };

      project.walls.forEach((wall, wIdx) => {
        ensureSpace(30);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30);
        doc.text(`${wall.name} — ${WALL_TYPE_LABELS[wall.wallType]}`, 15, y); y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Length: ${wall.length.toFixed(1)}m | Min Height: ${wall.minHeight}m | Max Height: ${wall.maxHeight}m`, 20, y); y += 4.5;
        doc.text(`Surcharge: ${wall.hasSurcharge ? 'Yes' : 'No'} | Fence above: ${wall.hasFenceAbove ? 'Yes' : 'No'} | Drainage: ${wall.hasDrainageRequired ? 'Yes' : 'No'}`, 20, y); y += 5;
        if (wall.notes) { doc.text(`Notes: ${wall.notes}`, 20, y); y += 4.5; }
        y += 2;

        drawTableHeader();

        const materials = estimateMaterials(wall);
        let wallSubtotal = 0;

        materials.forEach((m, i) => {
          ensureSpace(rowH + 2);
          if (i % 2 === 0) {
            doc.setFillColor(250, 250, 251);
            doc.rect(15, y - 1.5, rightMargin - 15, rowH, 'F');
          }
          drawMaterialIcon(doc, m.iconKey, colX.icon - 11, y - 0.5, 10);
          doc.setTextColor(30);
          doc.setFontSize(8.5);
          const itemLines = doc.splitTextToSize(m.item, colX.qty - colX.item - 4);
          doc.text(itemLines.slice(0, 2), colX.item, y + 3);
          doc.text(m.qtyWithWastage, colX.qty, y + 3, { align: 'right' });
          doc.text(m.unit, colX.unit, y + 3);
          if (m.unitPrice !== undefined) {
            doc.text(fmt(m.unitPrice), colX.unitPrice, y + 3, { align: 'right' });
          } else {
            doc.setTextColor(140);
            doc.text('—', colX.unitPrice, y + 3, { align: 'right' });
            doc.setTextColor(30);
          }
          if (m.totalPrice !== undefined) {
            doc.setFont('helvetica', 'bold');
            doc.text(fmt(m.totalPrice), colX.total, y + 3, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            wallSubtotal += m.totalPrice;
          } else {
            doc.setTextColor(140);
            doc.text('—', colX.total, y + 3, { align: 'right' });
            doc.setTextColor(30);
          }
          doc.setFontSize(7);
          doc.setTextColor(120);
          doc.text(`incl. ${m.wastagePercent}% wastage`, colX.item, y + 7.5);
          doc.setFontSize(8.5);
          doc.setTextColor(30);
          y += rowH;
        });

        ensureSpace(10);
        doc.setDrawColor(180);
        doc.line(15, y, rightMargin, y);
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`${wall.name} subtotal (materials, indicative)`, colX.item, y);
        doc.text(fmt(wallSubtotal), colX.total, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        y += 8;
        grandTotal += wallSubtotal;

        if (wIdx < project.walls.length - 1) ensureSpace(30);
      });

      ensureSpace(20);
      doc.setFillColor(45, 55, 72);
      doc.rect(15, y, rightMargin - 15, 10, 'F');
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('PROJECT MATERIALS TOTAL (indicative, excl. labour & GST)', 18, y + 6.5);
      doc.text(fmt(grandTotal), rightMargin - 3, y + 6.5, { align: 'right' });
      y += 14;
      doc.setTextColor(30);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Prices are indicative material-only estimates and exclude delivery, labour, plant hire, GST and engineering fees.', 15, y);
      y += 8;

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

      const fileSource = (project.details.isBuilder && project.details.companyName)
        ? project.details.companyName
        : project.details.clientName;
      const summaryName = `project-summary-${fileSource?.replace(/\s+/g, '-') || 'export'}.pdf`;
      const summaryBlob = doc.output('blob') as Blob;
      const sUrl = URL.createObjectURL(summaryBlob);
      const sa = document.createElement('a');
      sa.href = sUrl; sa.download = summaryName; sa.click();
      URL.revokeObjectURL(sUrl);
      uploadSubmissionFile(summaryName, summaryBlob, 'application/pdf').catch(() => {});
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
      const csvLines: string[] = [];
      const headers = ['SR', 'Wall', 'Category', 'Description', 'Quantity', 'Wastage %', 'Qty With Wastage', 'Unit', 'Unit Price AUD', 'Total AUD', 'Assumption'];
      csvLines.push(headers.map(c => `"${c}"`).join(','));

      let sr = 0;
      let csvGrand = 0;
      project.walls.forEach(wall => {
        const materials = estimateMaterials(wall);
        materials.forEach(m => {
          sr++;
          if (m.totalPrice !== undefined) csvGrand += m.totalPrice;
          csvLines.push([
            sr.toString(), wall.name, m.category, m.item, m.quantity,
            m.wastagePercent.toString(), m.qtyWithWastage, m.unit,
            m.unitPrice !== undefined ? m.unitPrice.toFixed(2) : '',
            m.totalPrice !== undefined ? m.totalPrice.toFixed(2) : '',
            m.assumption,
          ].map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
        });
      });
      csvLines.push('');
      csvLines.push(['', '', '', 'PROJECT MATERIALS TOTAL (indicative, excl. labour & GST)', '', '', '', '', '', csvGrand.toFixed(2), ''].map(c => `"${c}"`).join(','));

      const csv = csvLines.join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const csvSource = (project.details.isBuilder && project.details.companyName)
        ? project.details.companyName
        : project.details.clientName;
      const csvName = `material-takeoff-${csvSource?.replace(/\s+/g, '-') || 'export'}.csv`;
      a.download = csvName;
      a.click();
      URL.revokeObjectURL(url);
      uploadSubmissionFile(csvName, blob, 'text/csv').catch(() => {});
      toast.success('CSV downloaded');
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
        <span className="text-sm font-semibold">{loadingSitePlan ? 'Generating...' : 'Concept Site Plan (PDF)'}</span>
        {loadingSitePlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </Button>

      <Button
        onClick={generatePDFSummary}
        disabled={loadingSummary}
        className="w-full justify-between rounded-xl"
        variant="outline"
        size="lg"
      >
        <span className="text-sm font-semibold">{loadingSummary ? 'Generating...' : 'Project Summary (PDF)'}</span>
        {loadingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </Button>

      <Button
        onClick={generateCSV}
        disabled={loadingCSV}
        className="w-full justify-between rounded-xl"
        variant="outline"
        size="lg"
      >
        <span className="text-sm font-semibold">{loadingCSV ? 'Generating...' : 'Wall Schedule (CSV)'}</span>
        {loadingCSV ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export default ExportGenerator;
