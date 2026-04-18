import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AddressSearch from "./AddressSearch";
import MapCanvas from "./MapCanvas";
import WallEditorPanel from "./WallEditorPanel";
import PaymentGate from "./PaymentGate";
import ExportGenerator from "./ExportGenerator";
import ProductSelector from "./ProductSelector";
import { ProjectState, WallSegment, WallPoint } from "@/lib/types";
import { calculatePolylineLength, generateWallName } from "@/lib/wallCalculations";
import { useAutoSaveSubmission } from "@/hooks/useAutoSaveSubmission";
import { v4Fallback } from "@/lib/idUtils";
import { Input } from "@/components/ui/input";
import { FloatingInput } from "@/components/ui/floating-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Pencil, Layers, CreditCard, User, ChevronLeft, ChevronRight, Check, Undo2, Trash2 } from "lucide-react";

import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';

const STEPS = [
  { label: "Property", icon: MapPin },
  { label: "Draw", icon: Pencil },
  { label: "Materials", icon: BarChart3 },
  { label: "Export", icon: CreditCard },
];

const PlannerSection = () => {
  const [project, setProject] = useState<ProjectState>({
    details: {
      address: "",
      suburb: "",
      state: "",
      postcode: "",
      lat: 0,
      lng: 0,
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      isBuilder: false,
      companyName: "",
    },
    walls: [],
    siteContext: {
      distanceToHouse: "",
      distanceToBoundary: "",
      slopeNotes: "",
      accessNotes: "",
      adjoiningStructures: "",
      comments: "",
    },
    currentStep: 0,
    isPaid: false,
    disclaimerAccepted: false,
  });

  const [activeWallId, setActiveWallId] = useState<string | null>(null);
  useAutoSaveSubmission(project);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<WallPoint[]>([]);
  const [triedNext, setTriedNext] = useState(false);
  const mapCenter =
    project.details.lat && project.details.lng
      ? ([project.details.lng, project.details.lat] as [number, number])
      : null;

  const activeWall = project.walls.find((w) => w.id === activeWallId);

  const updateDetails = (partial: Partial<ProjectState["details"]>) => {
    setProject((p) => ({ ...p, details: { ...p.details, ...partial } }));
  };


  const updateWalls = (walls: WallSegment[]) => {
    setProject((p) => ({ ...p, walls }));
  };

  const updateWall = (updated: WallSegment) => {
    setProject((p) => ({
      ...p,
      walls: p.walls.map((w) => (w.id === updated.id ? updated : w)),
    }));
  };

  const deleteWall = (wallId: string) => {
    const wall = project.walls.find(w => w.id === wallId);
    if (!wall) return;
    updateWalls(project.walls.filter((w) => w.id !== wallId));
    if (activeWallId === wallId) setActiveWallId(null);
    toast('Wall deleted', { description: `${wall.name} has been removed` });
  };

  const setStep = (step: number) => {
    setProject((p) => ({ ...p, currentStep: step }));
  };

  // Step validation
  const hasAddress = !!project.details.address;
  const hasWalls = project.walls.length > 0;
  const isFullName = /^\S+\s+\S+/.test(project.details.clientName.trim());
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(project.details.clientEmail);
  const phoneDigits = project.details.clientPhone.replace(/\D/g, '');
  const isPhoneValid = phoneDigits.length >= 10 && phoneDigits.length <= 12;
  const hasContactInfo = isFullName && isEmailValid && isPhoneValid;

  const isStepAccessible = (step: number): boolean => {
    switch (step) {
      case 0: return true;
      case 1: return hasAddress && hasContactInfo;
      case 2: return hasAddress && hasContactInfo && hasWalls;
      case 3: return hasAddress && hasContactInfo && hasWalls;
      default: return false;
    }
  };

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 0: return hasAddress && hasContactInfo;
      case 1: return hasWalls;
      case 2: return hasWalls;
      case 3: return project.isPaid;
      default: return false;
    }
  };

  const handleStepClick = (step: number) => {
    if (isStepAccessible(step)) {
      setTriedNext(false);
      setStep(step);
    } else if (step > project.currentStep) {
      setTriedNext(true);
    }
  };

  const goNext = () => {
    const next = project.currentStep + 1;
    if (next < STEPS.length && isStepAccessible(next)) {
      setTriedNext(false);
      setStep(next);
    } else {
      setTriedNext(true);
    }
  };

  const goBack = () => {
    const prev = project.currentStep - 1;
    if (prev >= 0) setStep(prev);
  };

  return (
    <section id="planner" className="bg-background pb-20">
      <div className="container max-w-7xl px-4">
        {/* Address search */}
        <div className="mx-auto max-w-2xl pb-8 pt-6">
          <AddressSearch
            onSelect={(result) => {
              updateDetails(result);
              toast.success("Property found", {
                description: result.address,
              });
            }}
          />
        </div>

        {/* Main planner layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Map */}
          <div className="order-1">
             <MapCanvas
               center={mapCenter}
               walls={project.walls}
               onWallsChange={updateWalls}
               activeWallId={activeWallId}
               onActiveWallChange={setActiveWallId}
               isDrawing={isDrawing}
               onIsDrawingChange={setIsDrawing}
               currentPoints={currentPoints}
               onCurrentPointsChange={setCurrentPoints}
             />
          </div>

          {/* Side panel */}
          <div className="order-2 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-[#d4d4d4] bg-[#fafafa]">
              {/* Step nav */}
              <div className="flex overflow-x-auto border-b border-border scrollbar-hide">
                {STEPS.map((step, i) => {
                  const Icon = step.icon;
                  const accessible = isStepAccessible(i);
                  const complete = isStepComplete(i);
                  const active = project.currentStep === i;
                  return (
                    <button
                      key={i}
                      onClick={() => handleStepClick(i)}
                      disabled={!accessible}
                      className={`relative flex flex-1 flex-col items-center gap-1 px-3 py-3 text-[10px] font-medium transition-colors ${
                        active
                          ? "text-primary"
                          : accessible
                          ? "text-muted-foreground hover:text-foreground"
                          : "cursor-not-allowed text-muted-foreground/40"
                      }`}
                    >
                      <div className="relative">
                        <Icon className="h-4 w-4" />
                        {complete && !active && (
                          <div className="absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary">
                            <Check className="h-2 w-2 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      {step.label}
                    </button>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${((project.currentStep + 1) / STEPS.length) * 100}%` }}
                />
              </div>

              {/* Step content */}
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-5">
                {project.currentStep === 0 && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-semibold text-foreground">Property Details</h3>
                    <p className="text-sm text-muted-foreground">
                      Search your address above, then fill in your project details.
                    </p>

                    {project.details.address && (
                      <div className="rounded-lg bg-accent p-3">
                        <p className="text-xs font-medium text-accent-foreground">{project.details.address}</p>
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <User className="h-4 w-4 text-primary" />
                      Client Information
                    </div>

                    <div className="space-y-4">
                      <div>
                        <FloatingInput
                          id="clientName"
                          label="Full Name"
                          value={project.details.clientName}
                          onChange={(e) => updateDetails({ clientName: e.target.value })}
                          className={triedNext && !isFullName ? "border-destructive ring-1 ring-destructive" : ""}
                          required
                        />
                        {triedNext && !isFullName && (
                          <p className="text-xs text-destructive mt-1">Enter a valid full name</p>
                        )}
                      </div>
                      <div>
                        <FloatingInput
                          id="clientEmail"
                          label="Email"
                          type="email"
                          value={project.details.clientEmail}
                          onChange={(e) => updateDetails({ clientEmail: e.target.value })}
                          className={triedNext && !isEmailValid ? "border-destructive ring-1 ring-destructive" : ""}
                          required
                        />
                        {triedNext && !isEmailValid && (
                          <p className="text-xs text-destructive mt-1">Enter a valid email</p>
                        )}
                      </div>
                      <div>
                        <FloatingInput
                          id="clientPhone"
                          label="Phone"
                          type="tel"
                          value={project.details.clientPhone}
                          onChange={(e) => updateDetails({ clientPhone: e.target.value })}
                          className={triedNext && !isPhoneValid ? "border-destructive ring-1 ring-destructive" : ""}
                          required
                          maxLength={15}
                        />
                        {triedNext && !isPhoneValid && (
                          <p className="text-xs text-destructive mt-1">Enter a valid phone number</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 pt-1">
                        <Checkbox
                          id="isBuilder"
                          checked={project.details.isBuilder}
                          onCheckedChange={(checked) => updateDetails({ isBuilder: !!checked })}
                        />
                        <Label htmlFor="isBuilder" className="text-sm cursor-pointer">I am a builder</Label>
                      </div>
                      {project.details.isBuilder && (
                        <div>
                          <FloatingInput
                            id="companyName"
                            label="Company Name"
                            value={project.details.companyName}
                            onChange={(e) => updateDetails({ companyName: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {project.currentStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-semibold text-foreground">Draw Walls</h3>
                    <p className="text-sm text-muted-foreground">
                      Click <strong>"Start Drawing"</strong> below, then click points on the map. You'll be prompted for the height at each point.
                    </p>

                    {/* Drawing controls */}
                    <div className="space-y-2">
                      {!isDrawing ? (
                        <Button onClick={() => setIsDrawing(true)} className="w-full gap-2">
                          <Pencil className="h-4 w-4" />
                          {project.walls.length > 0 ? 'Draw Another Wall' : 'Start Drawing'}
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <Button
                            onClick={() => {
                              if (currentPoints.length < 2) {
                                setCurrentPoints([]);
                                setIsDrawing(false);
                                return;
                              }
                              const length = calculatePolylineLength(currentPoints);
                              const heights = currentPoints.map(p => p.height || 0).filter(h => h > 0);
                              const maxH = heights.length > 0 ? Math.max(...heights) : 1.2;
                              const minH = heights.length > 0 ? Math.min(...heights) : 0.8;
                              const newWall: WallSegment = {
                                id: v4Fallback(),
                                name: generateWallName(project.walls.length),
                                points: currentPoints,
                                wallType: 'concrete-sleeper',
                                length,
                                minHeight: parseFloat(minH.toFixed(2)),
                                maxHeight: parseFloat(maxH.toFixed(2)),
                                offsetFromDwelling: 0,
                                offsetFromBoundary: 0,
                                hasSurcharge: false,
                                hasFenceAbove: false,
                                fenceHeight: 1.5,
                                hasDrainageRequired: true,
                                onBoundary: false,
                                notes: '',
                                materialAssumptions: '',
                              };
                              updateWalls([...project.walls, newWall]);
                              setActiveWallId(newWall.id);
                              setCurrentPoints([]);
                              setIsDrawing(false);
                              toast.success(`${newWall.name} added`, { description: `${length.toFixed(1)}m retaining wall` });
                            }}
                            className="w-full gap-2"
                            disabled={currentPoints.length < 2}
                          >
                            Finish Wall {currentPoints.length >= 2 && `(${calculatePolylineLength(currentPoints).toFixed(1)}m)`}
                          </Button>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setCurrentPoints((prev) => prev.slice(0, -1))}
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1.5"
                              disabled={currentPoints.length === 0}
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Undo Point
                            </Button>
                            <Button
                              onClick={() => { setCurrentPoints([]); setIsDrawing(false); }}
                              variant="outline"
                              size="sm"
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground text-center">
                            Click on the map to place wall points
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Wall list with inline editing */}
                    {project.walls.length > 0 && (
                      <div className="space-y-2">
                        <Separator />
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Drawn Walls</p>
                        {project.walls.map((wall) => (
                          <div key={wall.id} className="rounded-lg border border-border overflow-hidden">
                            <div
                              onClick={() => setActiveWallId(activeWallId === wall.id ? null : wall.id)}
                              className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                                activeWallId === wall.id
                                  ? "bg-primary/10 text-foreground"
                                  : "bg-card text-foreground hover:bg-muted"
                              }`}
                            >
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteWall(wall.id); }}
                                className="text-destructive/60 hover:text-destructive transition-colors shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{wall.name}</span>
                                <span className="ml-2 text-muted-foreground text-xs">{wall.length.toFixed(1)}m</span>
                              </div>
                              <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${activeWallId === wall.id ? 'rotate-90' : ''}`} />
                            </div>
                            {activeWallId === wall.id && (
                              <div className="border-t border-border bg-card p-3">
                                <WallEditorPanel wall={wall} onChange={updateWall} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}


                {project.currentStep === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="font-display text-lg font-semibold text-foreground">Material Selection</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Pick a product for each wall. Pricing updates live based on length & height.
                      </p>
                    </div>

                    {project.walls.length === 0 && (
                      <p className="text-sm text-muted-foreground">Draw at least one wall to select materials.</p>
                    )}

                    {project.walls.map((wall) => (
                      <div key={wall.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">{wall.name}</p>
                          <span className="text-xs text-muted-foreground">
                            {wall.length.toFixed(1)}m · H {wall.maxHeight}m
                          </span>
                        </div>
                        <ProductSelector
                          wall={wall}
                          onSelect={(p) =>
                            updateWall({
                              ...wall,
                              selectedProductSku: p.sku ?? undefined,
                              selectedProductName: p.product_name,
                              selectedProductPrice: Number(p.price),
                            })
                          }
                        />
                      </div>
                    ))}

                    <p className="rounded-md border border-dashed border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
                      A detailed project summary PDF is available in the next step.
                    </p>
                  </div>
                )}

                {project.currentStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-semibold text-foreground">Export</h3>

                    <PaymentGate />

                    <ExportGenerator project={project} googleMapsApiKey={GOOGLE_MAPS_API_KEY} />
                  </div>
                )}

                {/* Next / Back navigation */}
                <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goBack}
                    disabled={project.currentStep === 0}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Step {project.currentStep + 1} of {STEPS.length}
                  </span>
                  {project.currentStep < STEPS.length - 1 && (
                    <Button
                      size="sm"
                      onClick={goNext}
                      disabled={!isStepAccessible(project.currentStep + 1)}
                      className="gap-1.5"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                  {project.currentStep === STEPS.length - 1 && (
                    <div className="w-[72px]" /> // Spacer to keep layout balanced
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PlannerSection;
