import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AddressSearch from "./AddressSearch";
import MapCanvas from "./MapCanvas";
import WallEditorPanel from "./WallEditorPanel";
import ProjectSummary from "./ProjectSummary";
import PaymentGate from "./PaymentGate";
import ExportGenerator from "./ExportGenerator";
import { ProjectState, WallSegment, SiteContext } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { MapPin, Pencil, Settings, Compass, BarChart3, CreditCard, User, ChevronLeft, ChevronRight, Check } from "lucide-react";

const MAPBOX_TOKEN = "pk.eyJ1IjoidXBsaWZ0YmEiLCJhIjoiY21rMHA3MXc2NzdnbTNjcTJzd2R1aW9jOCJ9.AbKUSzkWQp2MKowmen69LA";
// Replace with your actual Mapbox public token

const STEPS = [
  { label: "Property", icon: MapPin },
  { label: "Draw", icon: Pencil },
  { label: "Settings", icon: Settings },
  { label: "Context", icon: Compass },
  { label: "Summary", icon: BarChart3 },
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
      projectReference: "",
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
  const mapCenter =
    project.details.lat && project.details.lng
      ? ([project.details.lng, project.details.lat] as [number, number])
      : null;

  const activeWall = project.walls.find((w) => w.id === activeWallId);

  const updateDetails = (partial: Partial<ProjectState["details"]>) => {
    setProject((p) => ({ ...p, details: { ...p.details, ...partial } }));
  };

  const updateSiteContext = (partial: Partial<SiteContext>) => {
    setProject((p) => ({ ...p, siteContext: { ...p.siteContext, ...partial } }));
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

  const setStep = (step: number) => {
    setProject((p) => ({ ...p, currentStep: step }));
  };

  // Step validation: determine which steps are accessible
  const hasAddress = !!project.details.address;
  const hasWalls = project.walls.length > 0;

  const isStepAccessible = (step: number): boolean => {
    switch (step) {
      case 0: return true; // Property always accessible
      case 1: return hasAddress; // Draw requires address
      case 2: return hasAddress && hasWalls; // Settings requires walls
      case 3: return hasAddress; // Context accessible after address
      case 4: return hasAddress && hasWalls; // Summary requires walls
      case 5: return hasAddress && hasWalls; // Export requires walls
      default: return false;
    }
  };

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 0: return hasAddress;
      case 1: return hasWalls;
      case 2: return hasWalls && project.walls.every(w => w.averageHeight > 0);
      case 3: return true; // Context is optional
      case 4: return hasWalls;
      case 5: return project.isPaid;
      default: return false;
    }
  };

  const handleStepClick = (step: number) => {
    if (isStepAccessible(step)) {
      setStep(step);
    }
  };

  const goNext = () => {
    const next = project.currentStep + 1;
    if (next < STEPS.length && isStepAccessible(next)) setStep(next);
  };

  const goBack = () => {
    const prev = project.currentStep - 1;
    if (prev >= 0) setStep(prev);
  };

  // Email validation
  const isEmailValid = !project.details.clientEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(project.details.clientEmail);

  return (
    <section id="planner" className="bg-background pb-20">
      <div className="container max-w-7xl px-4">
        {/* Address search */}
        <div className="mx-auto max-w-2xl pb-8 pt-6">
          <AddressSearch
            mapboxToken={MAPBOX_TOKEN}
            onSelect={(result) => {
              updateDetails(result);
              setStep(1);
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
              mapboxToken={MAPBOX_TOKEN}
              center={mapCenter}
              walls={project.walls}
              onWallsChange={updateWalls}
              activeWallId={activeWallId}
              onActiveWallChange={setActiveWallId}
            />
          </div>

          {/* Side panel */}
          <div className="order-2 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-border bg-card shadow-card">
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
                          ? "border-b-2 border-primary text-primary"
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

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Client Name</Label>
                        <Input
                          value={project.details.clientName}
                          onChange={(e) => updateDetails({ clientName: e.target.value })}
                          placeholder="Full name"
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Email</Label>
                        <Input
                          type="email"
                          value={project.details.clientEmail}
                          onChange={(e) => updateDetails({ clientEmail: e.target.value })}
                          placeholder="email@example.com"
                          className={`rounded-lg ${!isEmailValid ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        />
                        {!isEmailValid && (
                          <p className="text-xs text-destructive">Please enter a valid email address</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Phone</Label>
                        <Input
                          type="tel"
                          value={project.details.clientPhone}
                          onChange={(e) => updateDetails({ clientPhone: e.target.value })}
                          placeholder="04XX XXX XXX"
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Project Reference</Label>
                        <Input
                          value={project.details.projectReference}
                          onChange={(e) => updateDetails({ projectReference: e.target.value })}
                          placeholder="e.g. RW-2026-001"
                          className="rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {project.currentStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-semibold text-foreground">Draw Walls</h3>
                    <p className="text-sm text-muted-foreground">
                      Use the <strong>"Draw Wall"</strong> button on the map to place retaining wall lines. Click points
                      to define the wall path, then click "Finish Wall".
                    </p>
                    {project.walls.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-muted/50 p-6 text-center">
                        <Pencil className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No walls drawn yet</p>
                        <p className="mt-1 text-xs text-muted-foreground/60">Click "Draw Wall" on the map to begin</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {project.walls.map((wall) => (
                          <button
                            key={wall.id}
                            onClick={() => setActiveWallId(wall.id)}
                            className={`w-full rounded-lg px-4 py-3 text-left text-sm transition-colors ${
                              activeWallId === wall.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground hover:bg-accent"
                            }`}
                          >
                            <span className="font-medium">{wall.name}</span>
                            <span className="ml-2 opacity-70">{wall.length.toFixed(1)}m</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {project.currentStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-semibold text-foreground">Wall Settings</h3>
                    {activeWall ? (
                      <WallEditorPanel wall={activeWall} onChange={updateWall} />
                    ) : project.walls.length > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Select a wall to edit its settings.
                        </p>
                        <div className="space-y-2">
                          {project.walls.map((wall) => (
                            <button
                              key={wall.id}
                              onClick={() => setActiveWallId(wall.id)}
                              className="w-full rounded-lg bg-muted px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
                            >
                              <span className="font-medium">{wall.name}</span>
                              <span className="ml-2 opacity-70">{wall.length.toFixed(1)}m</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-muted/50 p-6 text-center">
                        <Pencil className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No walls drawn yet</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => setStep(1)}
                        >
                          Go to Draw
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {project.currentStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-semibold text-foreground">Site Context</h3>
                    <p className="text-xs text-muted-foreground">
                      All measurements are user-confirmed approximations. Concept only.
                    </p>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Approximate distance to house</Label>
                        <Input
                          value={project.siteContext.distanceToHouse}
                          onChange={(e) => updateSiteContext({ distanceToHouse: e.target.value })}
                          placeholder="e.g. 3.5m"
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Approximate distance to boundary</Label>
                        <Input
                          value={project.siteContext.distanceToBoundary}
                          onChange={(e) => updateSiteContext({ distanceToBoundary: e.target.value })}
                          placeholder="e.g. 1.2m"
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Slope notes</Label>
                        <Textarea
                          value={project.siteContext.slopeNotes}
                          onChange={(e) => updateSiteContext({ slopeNotes: e.target.value })}
                          placeholder="Describe the site slope..."
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Access notes</Label>
                        <Textarea
                          value={project.siteContext.accessNotes}
                          onChange={(e) => updateSiteContext({ accessNotes: e.target.value })}
                          placeholder="Vehicle access, restrictions..."
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Adjoining structures</Label>
                        <Textarea
                          value={project.siteContext.adjoiningStructures}
                          onChange={(e) => updateSiteContext({ adjoiningStructures: e.target.value })}
                          placeholder="Fences, sheds, pools..."
                          className="rounded-lg"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Additional comments</Label>
                        <Textarea
                          value={project.siteContext.comments}
                          onChange={(e) => updateSiteContext({ comments: e.target.value })}
                          placeholder="Anything else relevant..."
                          className="rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {project.currentStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-semibold text-foreground">Summary</h3>
                    <ProjectSummary project={project} />
                  </div>
                )}

                {project.currentStep === 5 && (
                  <div className="space-y-4">
                    <h3 className="font-display text-lg font-semibold text-foreground">Export</h3>

                    <PaymentGate
                      isPaid={project.isPaid}
                      onPayment={() => setProject((p) => ({ ...p, isPaid: true }))}
                      disclaimerAccepted={project.disclaimerAccepted}
                      onDisclaimerChange={(v) => setProject((p) => ({ ...p, disclaimerAccepted: v }))}
                      wallCount={project.walls.length}
                    />

                    {project.isPaid && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <ExportGenerator project={project} mapboxToken={MAPBOX_TOKEN} />
                      </motion.div>
                    )}
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
