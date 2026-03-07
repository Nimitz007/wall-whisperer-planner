import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, FileText, Download, CreditCard } from 'lucide-react';

interface PaymentGateProps {
  isPaid: boolean;
  onPayment: () => void;
  disclaimerAccepted: boolean;
  onDisclaimerChange: (accepted: boolean) => void;
  wallCount: number;
}

const PaymentGate = ({ isPaid, onPayment, disclaimerAccepted, onDisclaimerChange, wallCount }: PaymentGateProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    // Stripe integration will go here
    setTimeout(() => {
      onPayment();
      setIsProcessing(false);
    }, 2000);
  };

  if (isPaid) {
    return (
      <div className="rounded-xl border border-primary/20 bg-accent p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
          <Download className="h-5 w-5 text-primary-foreground" />
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground">Export Pack Unlocked</h3>
        <p className="mt-1 text-sm text-muted-foreground">Your concept plan pack is ready for download.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-display text-xl font-bold text-foreground">Unlock Your Export Pack</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Get your concept retaining wall plan set with PDF plans, wall schedule, and materials summary.
        </p>

        {/* What's included */}
        <div className="mx-auto mt-6 max-w-sm space-y-3 text-left">
          <div className="flex items-center gap-3 text-sm text-foreground">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span>PDF concept site plan with labelled walls</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-foreground">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span>Project summary with wall schedule</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-foreground">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span>Indicative material quantities</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-foreground">
            <Download className="h-4 w-4 shrink-0 text-primary" />
            <span>CSV export of wall data</span>
          </div>
        </div>

        {/* Price */}
        <div className="mt-6">
          <span className="font-display text-4xl font-bold text-foreground">$600</span>
          <span className="ml-1 text-sm text-muted-foreground">AUD</span>
        </div>

        {/* Disclaimer checkbox */}
        <div className="mx-auto mt-6 max-w-sm">
          <label className="flex cursor-pointer items-start gap-3 text-left">
            <Checkbox
              checked={disclaimerAccepted}
              onCheckedChange={(checked) => onDisclaimerChange(checked === true)}
              className="mt-0.5"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              I understand this is a concept planning tool only and not a certified engineering design.
              Formal engineering certification is required before construction.
            </span>
          </label>
        </div>

        {/* Pay button */}
        <Button
          onClick={handlePayment}
          disabled={!disclaimerAccepted || wallCount === 0 || isProcessing}
          size="lg"
          className="mt-6 h-14 w-full max-w-sm rounded-xl text-base font-semibold shadow-card"
        >
          {isProcessing ? (
            'Processing...'
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Pay $600 AUD & Export
            </>
          )}
        </Button>

        {wallCount === 0 && (
          <p className="mt-3 text-xs text-destructive">Draw at least one retaining wall before purchasing.</p>
        )}

        <p className="mt-4 text-[10px] text-muted-foreground/60">
          Secure payment via Stripe. GST inclusive where applicable.
        </p>
      </div>
    </div>
  );
};

export default PaymentGate;
