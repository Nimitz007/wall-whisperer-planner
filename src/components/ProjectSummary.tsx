import { ProjectState, WALL_TYPE_LABELS } from '@/lib/types';
import { getTotalWallLength, estimateMaterials } from '@/lib/wallCalculations';
import { Separator } from '@/components/ui/separator';
import { MapPin, Ruler, Package, AlertTriangle } from 'lucide-react';

interface ProjectSummaryProps {
  project: ProjectState;
}

const ProjectSummary = ({ project }: ProjectSummaryProps) => {
  const totalLength = getTotalWallLength(project.walls);

  return (
    <div className="space-y-6">
      {/* Project info */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 text-primary">
          <MapPin className="h-4 w-4" />
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider">Project Details</h3>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <Row label="Address" value={project.details.address || '—'} />
          <Row label="Client" value={project.details.clientName || '—'} />
          <Row label="Email" value={project.details.clientEmail || '—'} />
          {project.details.isBuilder && <Row label="Company" value={project.details.companyName || '—'} />}
        </div>
      </div>

      {/* Wall schedule */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2 text-primary">
          <Ruler className="h-4 w-4" />
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider">Wall Schedule</h3>
        </div>
        <div className="mt-4 space-y-1 text-sm">
          <Row label="Total Wall Segments" value={project.walls.length.toString()} />
          <Row label="Total Wall Length" value={`${totalLength.toFixed(1)}m`} />
        </div>

        {project.walls.length > 0 && (
          <div className="mt-4">
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2 text-right">Length</th>
                    <th className="px-3 py-2 text-right">Height</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {project.walls.map(wall => (
                    <tr key={wall.id} className="text-foreground">
                      <td className="px-3 py-2 font-medium">{wall.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{WALL_TYPE_LABELS[wall.wallType]}</td>
                      <td className="px-3 py-2 text-right">{wall.length.toFixed(1)}m</td>
                      <td className="px-3 py-2 text-right">{wall.averageHeight}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Material estimates */}
      {project.walls.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-primary">
            <Package className="h-4 w-4" />
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider">Indicative Material Summary</h3>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            These quantities are approximate and indicative only. Verify with your engineer.
          </p>

          {project.walls.map(wall => {
            const materials = estimateMaterials(wall);
            return (
              <div key={wall.id} className="mt-4">
                <p className="mb-2 text-sm font-semibold text-foreground">{wall.name} — {WALL_TYPE_LABELS[wall.wallType]}</p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2">Unit</th>
                        <th className="px-3 py-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {materials.map((m, i) => (
                        <tr key={i} className="text-foreground">
                          <td className="px-3 py-2">{m.item}</td>
                          <td className="px-3 py-2 text-right font-medium">{m.quantity}</td>
                          <td className="px-3 py-2 text-muted-foreground">{m.unit}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{m.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="text-xs leading-relaxed text-foreground/80">
            <p className="font-semibold">Concept Planning Tool — Not for Construction</p>
            <p className="mt-1">
              This tool provides preliminary concept planning information only.
              Measurements and outputs are approximate unless verified by survey.
              Outputs are not certified engineering drawings.
              Not for construction or council approval.
              Formal engineering design and certification are required before construction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export default ProjectSummary;
