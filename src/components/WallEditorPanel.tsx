import { WallSegment, WallType, WALL_TYPE_LABELS } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Ruler, AlertTriangle, Package } from 'lucide-react';
import ProductSelector from './ProductSelector';
import { Product } from '@/lib/products';

interface WallEditorPanelProps {
  wall: WallSegment;
  onChange: (updated: WallSegment) => void;
}

const WallEditorPanel = ({ wall, onChange }: WallEditorPanelProps) => {
  const update = (partial: Partial<WallSegment>) => onChange({ ...wall, ...partial });

  const warnings: string[] = [];
  if (wall.length < 0.5) {
    warnings.push('Wall length is very short — check placement');
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Ruler className="h-5 w-5 text-primary" />
        <div>
          <h4 className="font-display text-base font-semibold text-foreground">{wall.name}</h4>
          <p className="text-sm text-muted-foreground">{wall.length.toFixed(1)}m total length</p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/50">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <Separator />

      {/* Wall Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Wall Type</Label>
        <Select value={wall.wallType} onValueChange={(v) => update({ wallType: v as WallType })}>
          <SelectTrigger className="rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(WALL_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {wall.wallType === 'concrete-sleeper' && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium text-foreground">Sleeper Selection</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Choose the sleeper finish for this wall. Estimated unit count and price range update with wall length and height.
            </p>
            <ProductSelector
              wall={wall}
              onSelect={(p: Product) => update({
                selectedProductSku: p.sku ?? undefined,
                selectedProductName: `${p.product_name} – ${p.colour ?? ''} ${p.size ?? ''}`.trim(),
                selectedProductPrice: Number(p.price),
              })}
            />
            {wall.selectedProductName && (
              <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
                <p className="font-medium text-foreground">Selected:</p>
                <p className="text-muted-foreground">{wall.selectedProductName}</p>
              </div>
            )}
          </div>
        </>
      )}

      <Separator />

      {/* Conditions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-foreground">Fence above?</Label>
          <Switch checked={wall.hasFenceAbove} onCheckedChange={(v) => update({ hasFenceAbove: v, fenceHeight: v ? (wall.fenceHeight || 1.5) : 0 })} />
        </div>
        {wall.hasFenceAbove && (
          <div className="flex items-center justify-between pl-2">
            <Label className="text-sm text-muted-foreground">Fence height (m)</Label>
            <Input
              type="number"
              step="0.1"
              min="0.3"
              max="3"
              value={wall.fenceHeight || 1.5}
              onChange={(e) => update({ fenceHeight: parseFloat(e.target.value) || 1.5 })}
              className="w-20 h-8 text-sm"
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <Label className="text-sm text-foreground">Driveway or building surcharge?</Label>
          <Switch checked={wall.hasSurcharge} onCheckedChange={(v) => update({ hasSurcharge: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm text-foreground">On boundary?</Label>
          <Switch checked={wall.onBoundary} onCheckedChange={(v) => update({ onBoundary: v })} />
        </div>
      </div>
    </div>
  );
};

export default WallEditorPanel;
