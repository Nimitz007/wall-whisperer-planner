import { useEffect, useState } from 'react';
import { Product, fetchSelectableProducts, productImageUrl, estimateSleeperQty, priceRange } from '@/lib/products';
import { WallSegment } from '@/lib/types';
import { Check, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductSelectorProps {
  wall: WallSegment;
  onSelect: (product: Product) => void;
}

const fmt = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;

const ProductSelector = ({ wall, onSelect }: ProductSelectorProps) => {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSelectableProducts(wall.wallType)
      .then(setProducts)
      .catch((e) => setError(e.message ?? 'Failed to load products'));
  }, [wall.wallType]);

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>;
  }

  if (!products) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
        <Package className="mx-auto mb-2 h-5 w-5" />
        No selectable products configured for this wall type yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {products.map((p) => {
        const selected = wall.selectedProductSku === p.sku;
        const qty = estimateSleeperQty(wall.length, wall.maxHeight || 1, p.size);
        const { low, high } = priceRange(Number(p.price), qty);
        const img = productImageUrl(p.image_path);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={`group relative flex flex-col overflow-hidden rounded-lg border-2 bg-card text-left transition-all hover:shadow-md ${
              selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'
            }`}
          >
            {selected && (
              <div className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
            <div className="relative aspect-square w-full overflow-hidden bg-muted">
              {img ? (
                <img
                  src={img}
                  alt={`${p.product_name} ${p.colour ?? ''}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Package className="h-6 w-6" />
                </div>
              )}
            </div>
            <div className="space-y-1 p-2">
              <p className="text-[11px] font-semibold leading-tight text-foreground line-clamp-2">{p.product_name}</p>
              <p className="text-[10px] text-muted-foreground">{p.colour} · {p.size}</p>
              <p className="text-[10px] font-medium text-primary">
                {fmt(Number(p.price))} ea
              </p>
              {qty > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  ~{qty} units · {fmt(low)}–{fmt(high)}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ProductSelector;
