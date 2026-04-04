import { ProjectState, WALL_TYPE_LABELS } from '@/lib/types';
import { getTotalWallLength, estimateMaterials } from '@/lib/wallCalculations';
import { useBranding } from '@/contexts/BrandingContext';
import { MapPin, Ruler, Package, AlertTriangle } from 'lucide-react';

interface ProjectSummaryProps {
  project: ProjectState;
}

const ProjectSummary = ({ project }: ProjectSummaryProps) => {
  const totalLength = getTotalWallLength(project.walls);
  const branding = useBranding();

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
                    <th className="px-3 py-2 text-right">Length</th>
                    <th className="px-3 py-2 text-right">Max Height</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {project.walls.map(wall => (
                    <tr key={wall.id} className="text-foreground">
                      <td className="px-3 py-2 font-medium">{wall.name}</td>
                      <td className="px-3 py-2 text-right">{wall.length.toFixed(1)}m</td>
                      <td className="px-3 py-2 text-right">{wall.maxHeight}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Material Takeoff Schedule */}
      {project.walls.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-primary">
            <Package className="h-4 w-4" />
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider">
              Material Offtake Schedule
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Indicative quantities only — verify with your engineer before ordering.
          </p>

          {project.walls.map((wall, wallIdx) => {
            const materials = estimateMaterials(wall);
            // Group by category
            const categories = Array.from(new Set(materials.map(m => m.category)));
            let srNo = 0;

            return (
              <div key={wall.id} className="mt-5">
                {/* Wall header bar */}
                <div className="flex items-center gap-3 rounded-t-lg bg-primary px-4 py-2">
                  <span className="text-sm font-bold text-primary-foreground">
                    {wall.name} — {WALL_TYPE_LABELS[wall.wallType]}
                  </span>
                  <span className="ml-auto text-xs text-primary-foreground/80">
                    {wall.length.toFixed(1)}m long · Max {wall.maxHeight}m · Min {wall.minHeight}m
                  </span>
                </div>

                <div className="overflow-x-auto rounded-b-lg border border-t-0 border-border">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="w-[44px] px-2 py-2 text-center">SR.</th>
                        <th className="min-w-[200px] px-2 py-2">Description</th>
                        <th className="w-[70px] px-2 py-2 text-right">Qty</th>
                        <th className="w-[60px] px-2 py-2 text-center">Wastage</th>
                        <th className="w-[80px] px-2 py-2 text-right">Qty + Waste</th>
                        <th className="w-[50px] px-2 py-2 text-center">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map(cat => {
                        const catItems = materials.filter(m => m.category === cat);
                        return (
                          <React.Fragment key={cat}>
                            {/* Category header row */}
                            <tr className="bg-accent/60">
                              <td colSpan={6} className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                                {cat}
                              </td>
                            </tr>
                            {catItems.map((m) => {
                              srNo++;
                              return (
                                <tr key={srNo} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                                  <td className="px-2 py-2 text-center text-muted-foreground">{srNo}</td>
                                  <td className="px-2 py-2">
                                    <span className="font-medium text-foreground">{m.item}</span>
                                    {m.notes && (
                                      <span className="ml-1 text-muted-foreground">— {m.notes}</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-right font-medium tabular-nums text-foreground">{m.quantity}</td>
                                  <td className="px-2 py-2 text-center text-muted-foreground">{m.wastagePercent}%</td>
                                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">{m.qtyWithWastage}</td>
                                  <td className="px-2 py-2 text-center text-muted-foreground">{m.unit}</td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Assumptions / Notes */}
                <div className="mt-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assumptions & Calculation Notes</p>
                  <ul className="space-y-1">
                    {materials.map((m, i) => (
                      <li key={i} className="flex gap-2 text-[11px] leading-snug text-muted-foreground">
                        <span className="shrink-0 font-medium text-foreground/70">{i + 1}.</span>
                        <span><strong>{m.item}:</strong> {m.assumption}</span>
                      </li>
                    ))}
                  </ul>
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

import React from 'react';
export default ProjectSummary;
