import { WallSegment, WallType, WALL_TYPE_LABELS } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Ruler, Building2, Square } from 'lucide-react';

interface WallEditorPanelProps {
  wall: WallSegment;
  onChange: (updated: WallSegment) => void;
}

const WallEditorPanel = ({ wall, onChange }: WallEditorPanelProps) => {
  const update = (partial: Partial<WallSegment>) => onChange({ ...wall, ...partial });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Ruler className="h-5 w-5 text-primary" />
        <div>
          <h4 className="font-display text-base font-semibold text-foreground">{wall.name}</h4>
          <p className="text-sm text-muted-foreground">{wall.length.toFixed(1)}m total length</p>
        </div>
      </div>

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

      {/* Heights */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm text-foreground">Average Height (m)</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={wall.averageHeight}
            onChange={(e) => update({ averageHeight: parseFloat(e.target.value) || 0 })}
            className="rounded-lg"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-foreground">Max Height (m)</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={wall.maxHeight}
            onChange={(e) => update({ maxHeight: parseFloat(e.target.value) || 0 })}
            className="rounded-lg"
          />
        </div>
      </div>

      {/* Offsets */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm text-foreground">
            <Building2 className="h-3.5 w-3.5" /> Distance to house (m)
          </Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={wall.offsetFromDwelling}
            onChange={(e) => update({ offsetFromDwelling: parseFloat(e.target.value) || 0 })}
            className="rounded-lg"
          />
          <p className="text-[10px] text-muted-foreground">Approximate — user-confirmed</p>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-sm text-foreground">
            <Square className="h-3.5 w-3.5" /> Distance to boundary (m)
          </Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={wall.offsetFromBoundary}
            onChange={(e) => update({ offsetFromBoundary: parseFloat(e.target.value) || 0 })}
            className="rounded-lg"
          />
          <p className="text-[10px] text-muted-foreground">Concept measurement only</p>
        </div>
      </div>

      <Separator />

      {/* Conditions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-foreground">Fence or load above wall?</Label>
          <Switch checked={wall.hasFenceAbove} onCheckedChange={(v) => update({ hasFenceAbove: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm text-foreground">Driveway or building surcharge?</Label>
          <Switch checked={wall.hasSurcharge} onCheckedChange={(v) => update({ hasSurcharge: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm text-foreground">Drainage required?</Label>
          <Switch checked={wall.hasDrainageRequired} onCheckedChange={(v) => update({ hasDrainageRequired: v })} />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-sm text-foreground">Notes</Label>
        <Textarea
          value={wall.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Add any notes about this wall segment..."
          className="min-h-[80px] rounded-lg text-sm"
        />
      </div>
    </div>
  );
};

export default WallEditorPanel;
