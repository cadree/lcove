import { useState, useEffect } from 'react';
import { useCreateStore, useUpdateStore, Store } from '@/hooks/useStore';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Upload, Store as StoreIcon, Link, ExternalLink, Loader2 } from 'lucide-react';
import { STORE_PLATFORM_FEE_PERCENT } from '@/lib/fees';

interface StoreSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store?: Store | null;
}

export const StoreSetupDialog = ({ open, onOpenChange, store }: StoreSetupDialogProps) => {
  const createStore = useCreateStore();
  const { user } = useAuth();
  const updateStore = useUpdateStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [acceptsCredits, setAcceptsCredits] = useState(true);
  const [acceptsCash, setAcceptsCash] = useState(true);
  const [shopifyUrl, setShopifyUrl] = useState('');
  const [peerspaceUrl, setPeerspaceUrl] = useState('');
  const [flatShipping, setFlatShipping] = useState('0');
  const [taxLabel, setTaxLabel] = useState('');
  const [taxAmount, setTaxAmount] = useState('0');
  const [isUploading, setIsUploading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  // Sync state with store prop when it changes
  useEffect(() => {
    if (store) {
      setName(store.name || '');
      setDescription(store.description || '');
      setLogoUrl(store.logo_url || '');
      setCoverImageUrl(store.cover_image_url || '');
      setAcceptsCredits(store.accepts_credits ?? true);
      setAcceptsCash(store.accepts_cash ?? true);
      setShopifyUrl(store.shopify_store_url || '');
      setPeerspaceUrl(store.peerspace_url || '');
      setFlatShipping(((store.flat_shipping_cents || 0) / 100).toString());
      setTaxLabel(store.tax_line_label || '');
      setTaxAmount(((store.tax_line_cents || 0) / 100).toString());
    } else {
      setName('');
      setDescription('');
      setLogoUrl('');
      setCoverImageUrl('');
      setAcceptsCredits(true);
      setAcceptsCash(true);
      setShopifyUrl('');
      setPeerspaceUrl('');
      setFlatShipping('0');
      setTaxLabel('');
      setTaxAmount('0');
    }
  }, [store, open]);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) {
      toast.error('Sign in to upload');
      return;
    }

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${user.id}/stores/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, file);

    if (uploadError) {
      toast.error('Failed to upload image');
      setIsUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    setter(publicUrl);
    setIsUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a store name');
      return;
    }

    const storeData = {
      name: name.trim(),
      description: description.trim() || null,
      logo_url: logoUrl || null,
      cover_image_url: coverImageUrl || null,
      accepts_credits: acceptsCredits,
      accepts_cash: acceptsCash,
      shopify_store_url: shopifyUrl.trim() || null,
      peerspace_url: peerspaceUrl.trim() || null,
      flat_shipping_cents: Math.max(0, Math.round((Number(flatShipping) || 0) * 100)),
      tax_line_label: taxLabel.trim() || null,
      tax_line_cents: Math.max(0, Math.round((Number(taxAmount) || 0) * 100)),
    };

    try {
      if (store) {
        await updateStore.mutateAsync({ id: store.id, ...storeData });
      } else {
        await createStore.mutateAsync(storeData);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StoreIcon className="w-5 h-5 text-primary" />
            {store ? 'Edit Store' : 'Create Your Store'}
          </DialogTitle>
          <DialogDescription>
            {store 
              ? 'Update your store settings and appearance.'
              : 'Set up your personal storefront to sell products, services, and rentals.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover Image */}
          <div className="space-y-2">
            <Label>Cover Image</Label>
            <div className="relative h-32 rounded-lg overflow-hidden bg-muted">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">No cover image</span>
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, setCoverImageUrl)}
                  disabled={isUploading}
                />
                <Upload className="w-6 h-6 text-foreground" />
              </label>
            </div>
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full overflow-hidden bg-muted">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <StoreIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer rounded-full">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, setLogoUrl)}
                    disabled={isUploading}
                  />
                  <Upload className="w-4 h-4 text-foreground" />
                </label>
              </div>
              <span className="text-sm text-muted-foreground">
                Upload a logo for your store
              </span>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Store Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your store name"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell customers about your store..."
              rows={3}
            />
          </div>

          {/* Payment Options */}
          <div className="space-y-3">
            <Label>Payment Options</Label>
            <div className="flex items-center justify-between">
              <span className="text-sm">Accept Cash (USD)</span>
              <Switch
                checked={acceptsCash}
                onCheckedChange={setAcceptsCash}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Accept LC Credits</span>
              <Switch
                checked={acceptsCredits}
                onCheckedChange={setAcceptsCredits}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping">Shipping amount you charge</Label>
              <Input
                id="shipping"
                type="number"
                min={0}
                step="0.01"
                value={flatShipping}
                onChange={(e) => setFlatShipping(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="tax-label">Tax line label</Label>
                <Input
                  id="tax-label"
                  value={taxLabel}
                  onChange={(e) => setTaxLabel(e.target.value)}
                  placeholder="Sales tax"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax-amount">Tax amount</Label>
                <Input
                  id="tax-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              You arrange shipping. Enter what you charge the buyer, or leave it at 0. Ether does not set shipping rates or regions. The tax line is a flat amount you enter.
            </p>
            <p className="text-xs text-muted-foreground">
              Ether checkout keeps a {STORE_PLATFORM_FEE_PERCENT}% platform fee on the item price. Shipping and this tax line are not part of that fee. Linked Shopify sales are paid on Shopify, and Ether does not take a fee on those.
            </p>
          </div>

          {/* External Integrations */}
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Link className="w-4 h-4 text-primary" />
              <Label className="text-base font-medium">External Integrations</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Link your existing Shopify or Peerspace shop. Linked Shopify products stay on Shopify. Ether does not take a fee on those sales. Buyers pay Shopify, not Ether.
            </p>

            {/* Shopify */}
            <div className="space-y-2">
              <Label htmlFor="shopify" className="flex items-center gap-2">
                Shopify Store URL
                {shopifyUrl && (
                  <a
                    href={shopifyUrl.startsWith('http') ? shopifyUrl : `https://${shopifyUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </Label>
              <Input
                id="shopify"
                value={shopifyUrl}
                onChange={(e) => setShopifyUrl(e.target.value)}
                placeholder="mystore.myshopify.com"
              />
              <p className="text-xs text-muted-foreground">
                Ether reads the public product list at this shop (up to 250 products) and copies title, price, image, and handle. Buy buttons link to https://your-shop/products/handle. No Shopify login. Ether does not take a fee on those sales.
              </p>
              {store && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLinking || !shopifyUrl.trim()}
                  onClick={async () => {
                    setIsLinking(true);
                    try {
                      await updateStore.mutateAsync({
                        id: store.id,
                        shopify_store_url: shopifyUrl.trim(),
                      });
                      const { data, error } = await supabase.functions.invoke('import-shopify-products', {
                        body: { storeId: store.id, shopUrl: shopifyUrl.trim() },
                      });
                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);
                      toast.success(`Linked ${data?.imported ?? 0} Shopify products. Ether does not take a fee on those sales.`);
                    } catch (err) {
                      const message = err instanceof Error ? err.message : 'Could not link products';
                      toast.error(message);
                    } finally {
                      setIsLinking(false);
                    }
                  }}
                >
                  {isLinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link className="w-4 h-4 mr-2" />}
                  Link products
                </Button>
              )}
            </div>

            {/* Peerspace */}
            <div className="space-y-2">
              <Label htmlFor="peerspace" className="flex items-center gap-2">
                Peerspace Profile URL
                {peerspaceUrl && (
                  <a
                    href={peerspaceUrl.startsWith('http') ? peerspaceUrl : `https://${peerspaceUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </Label>
              <Input
                id="peerspace"
                value={peerspaceUrl}
                onChange={(e) => setPeerspaceUrl(e.target.value)}
                placeholder="peerspace.com/pages/listings/..."
              />
              <p className="text-xs text-muted-foreground">
                Enter your Peerspace profile or listing URL
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={createStore.isPending || updateStore.isPending || isUploading}
            >
              {store ? 'Save Changes' : 'Create Store'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
