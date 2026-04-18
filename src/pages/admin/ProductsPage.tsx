import { useEffect, useState } from 'react';
import { Product, fetchAllProducts, productImageUrl } from '@/lib/products';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Save, Upload, Package } from 'lucide-react';

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<Product>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await fetchAllProducts();
      setProducts(data);
      setEdits({});
    } catch (e) {
      toast.error('Failed to load products');
    }
  };

  useEffect(() => { load(); }, []);

  const setEdit = (id: string, partial: Partial<Product>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...partial } }));
  };

  const save = async (p: Product) => {
    const patch = edits[p.id];
    if (!patch) return;
    setSaving(p.id);
    const { error } = await supabase.from('products').update(patch).eq('id', p.id);
    setSaving(null);
    if (error) {
      toast.error('Save failed', { description: error.message });
      return;
    }
    toast.success('Saved');
    load();
  };

  const uploadImage = async (p: Product, file: File) => {
    const path = `${p.sku ?? p.id}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, {
      contentType: file.type, upsert: true,
    });
    if (error) { toast.error('Upload failed', { description: error.message }); return; }
    await supabase.from('products').update({ image_path: path, image_filename: file.name }).eq('id', p.id);
    toast.success('Image updated');
    load();
  };

  if (!products) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Package className="h-6 w-6" /> Products & Pricing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edit prices, toggle which sleepers appear in the public planner, and replace product images.
          </p>
        </div>
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Image</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Size / Colour</TableHead>
              <TableHead className="w-32">Price (AUD)</TableHead>
              <TableHead className="w-28">In Planner</TableHead>
              <TableHead className="w-24">Active</TableHead>
              <TableHead className="w-44">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const e = edits[p.id] ?? {};
              const merged = { ...p, ...e };
              const dirty = Object.keys(e).length > 0;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="h-14 w-14 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                      {merged.image_path ? (
                        <img src={productImageUrl(merged.image_path)!} alt={merged.product_name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>{p.product_name}</div>
                    <div className="text-xs text-muted-foreground">{p.sku}</div>
                  </TableCell>
                  <TableCell className="text-sm">{p.category}</TableCell>
                  <TableCell className="text-sm">
                    <div>{p.size}</div>
                    <div className="text-xs text-muted-foreground">{p.colour ?? '—'}</div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={merged.price}
                      onChange={(ev) => setEdit(p.id, { price: parseFloat(ev.target.value) || 0 })}
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={!!merged.is_selectable}
                      onCheckedChange={(v) => setEdit(p.id, { is_selectable: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={!!merged.active}
                      onCheckedChange={(v) => setEdit(p.id, { active: v })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={!dirty || saving === p.id} onClick={() => save(p)}>
                        <Save className="h-3.5 w-3.5 mr-1" /> Save
                      </Button>
                      <Label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(ev) => {
                            const f = ev.target.files?.[0];
                            if (f) uploadImage(p, f);
                          }}
                        />
                        <span className="inline-flex items-center gap-1 h-9 px-3 rounded-md border text-xs hover:bg-muted">
                          <Upload className="h-3.5 w-3.5" /> Image
                        </span>
                      </Label>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ProductsPage;
