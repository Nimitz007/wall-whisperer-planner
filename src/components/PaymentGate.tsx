import { Gift } from 'lucide-react';

const PaymentGate = () => {
  return (
    <div className="rounded-xl border border-primary/20 bg-accent p-5 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary">
        <Gift className="h-5 w-5 text-primary-foreground" />
      </div>
      <h3 className="font-display text-base font-semibold text-foreground">Free for a Limited Time</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Export your concept plan pack at no cost during our early access period.
      </p>
    </div>
  );
};

export default PaymentGate;
