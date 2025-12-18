import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateNetwork, useContentGenres } from '@/hooks/useCinema';
import { Film, Upload, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateNetworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateNetworkDialog = ({ open, onOpenChange }: CreateNetworkDialogProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState('9.99');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: genres = [] } = useContentGenres();
  const createNetwork = useCreateNetwork();

  const uploadImage = async (file: File, path: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('media')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data } = supabase.storage.from('media').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Network name is required');
      return;
    }

    setUploading(true);

    try {
      let bannerUrl = null;
      let logoUrl = null;

      if (bannerFile) {
        bannerUrl = await uploadImage(bannerFile, 'network-banners');
      }
      if (logoFile) {
        logoUrl = await uploadImage(logoFile, 'network-logos');
      }

      await createNetwork.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        genre: genre || null,
        is_paid: isPaid,
        subscription_price: isPaid ? parseFloat(subscriptionPrice) : 0,
        banner_url: bannerUrl,
        logo_url: logoUrl,
        is_public: true,
      });

      // Reset form
      setName('');
      setDescription('');
      setGenre('');
      setIsPaid(false);
      setSubscriptionPrice('9.99');
      setBannerFile(null);
      setLogoFile(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create network:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Create Your Network
          </DialogTitle>
          <DialogDescription>
            Launch your own streaming network to distribute films, shows, and more.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Network Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Network Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Cinema Network"
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
              placeholder="Describe your network and the content you'll feature..."
              rows={3}
            />
          </div>

          {/* Genre */}
          <div className="space-y-2">
            <Label>Primary Genre</Label>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger>
                <SelectValue placeholder="Select a genre" />
              </SelectTrigger>
              <SelectContent>
                {genres.map((g) => (
                  <SelectItem key={g.id} value={g.name}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Banner Upload */}
          <div className="space-y-2">
            <Label>Banner Image</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              {bannerFile ? (
                <div className="space-y-2">
                  <img
                    src={URL.createObjectURL(bannerFile)}
                    alt="Banner preview"
                    className="max-h-32 mx-auto rounded"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setBannerFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload banner (16:9 recommended)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Network Logo</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              {logoFile ? (
                <div className="space-y-2">
                  <img
                    src={URL.createObjectURL(logoFile)}
                    alt="Logo preview"
                    className="w-20 h-20 mx-auto rounded-xl object-cover"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload logo (square)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Monetization */}
          <div className="space-y-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Paid Subscription
                </Label>
                <p className="text-sm text-muted-foreground">
                  Charge viewers a monthly fee
                </p>
              </div>
              <Switch checked={isPaid} onCheckedChange={setIsPaid} />
            </div>

            {isPaid && (
              <div className="space-y-2">
                <Label htmlFor="price">Monthly Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0.99"
                  step="0.01"
                  value={subscriptionPrice}
                  onChange={(e) => setSubscriptionPrice(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Platform takes a small fee from each subscription
                </p>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={uploading || createNetwork.isPending}
            >
              {uploading || createNetwork.isPending ? 'Creating...' : 'Create Network'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
