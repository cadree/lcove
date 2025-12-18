import { useState } from 'react';
import { useCreateStore, useUpdateStore, Store } from '@/hooks/useStore';
import { supabase } from '@/integrations/supabase/client';
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
import { toast } from 'sonner';
import { Upload, Store as StoreIcon } from 'lucide-react';

interface StoreSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store?: Store | null;
}

export const StoreSetupDialog = ({ open, onOpenChange, store }: StoreSetupDialogProps) => {
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();

  const [name, setName] = useState(store?.name || '');
  const [description, setDescription] = useState(store?.description || '');
  const [logoUrl, setLogoUrl] = useState(store?.logo_url || '');
  const [coverImageUrl, setCoverImageUrl] = useState(store?.cover_image_url || '');
  const [acceptsCredits, setAcceptsCredits] = useState(store?.accepts_credits ?? true);
  const [acceptsCash, setAcceptsCash] = useState(store?.accepts_cash ?? true);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `stores/${fileName}`;

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
      <DialogContent className="max-w-md">
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
