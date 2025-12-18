import { useState, useEffect } from 'react';
import { useCreateStoreItem, useUpdateStoreItem, useStoreCategories, useMyStore, StoreItem } from '@/hooks/useStore';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, X, Upload, Package, Wrench, Building2 } from 'lucide-react';

interface CreateItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: StoreItem | null;
  defaultType?: 'product' | 'service' | 'rental';
}

const typeOptions = [
  { value: 'product', label: 'Product', icon: Package },
  { value: 'service', label: 'Service', icon: Wrench },
  { value: 'rental', label: 'Studio Rental', icon: Building2 },
];

export const CreateItemDialog = ({ open, onOpenChange, editItem, defaultType }: CreateItemDialogProps) => {
  const { data: store } = useMyStore();
  const { data: categories } = useStoreCategories();
  const createItem = useCreateStoreItem();
  const updateItem = useUpdateStoreItem();

  const [type, setType] = useState<'product' | 'service' | 'rental'>(defaultType || 'product');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [creditsPrice, setCreditsPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [inventoryCount, setInventoryCount] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [location, setLocation] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [newAmenity, setNewAmenity] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (editItem) {
      setType(editItem.type);
      setTitle(editItem.title);
      setDescription(editItem.description || '');
      setPrice(editItem.price?.toString() || '');
      setCreditsPrice(editItem.credits_price?.toString() || '');
      setCategoryId(editItem.category_id || '');
      setImages(editItem.images || []);
      setInventoryCount(editItem.inventory_count?.toString() || '');
      setDurationMinutes(editItem.duration_minutes?.toString() || '');
      setLocation(editItem.location || '');
      setAmenities(editItem.amenities || []);
      setContactEmail(editItem.contact_email || '');
      setContactPhone(editItem.contact_phone || '');
      setIsActive(editItem.is_active);
    } else {
      resetForm();
      if (defaultType) setType(defaultType);
    }
  }, [editItem, defaultType, open]);

  const resetForm = () => {
    setType(defaultType || 'product');
    setTitle('');
    setDescription('');
    setPrice('');
    setCreditsPrice('');
    setCategoryId('');
    setImages([]);
    setInventoryCount('');
    setDurationMinutes('');
    setLocation('');
    setAmenities([]);
    setNewAmenity('');
    setContactEmail('');
    setContactPhone('');
    setIsActive(true);
  };

  const filteredCategories = categories?.filter((c) => c.type === type) || [];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const uploadedUrls: string[] = [];

    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `store-items/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
    }

    setImages((prev) => [...prev, ...uploadedUrls]);
    setIsUploading(false);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const addAmenity = () => {
    if (newAmenity.trim() && !amenities.includes(newAmenity.trim())) {
      setAmenities((prev) => [...prev, newAmenity.trim()]);
      setNewAmenity('');
    }
  };

  const removeAmenity = (amenity: string) => {
    setAmenities((prev) => prev.filter((a) => a !== amenity));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!store) {
      toast.error('Please create a store first');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    const itemData = {
      store_id: store.id,
      type,
      title: title.trim(),
      description: description.trim() || null,
      price: parseFloat(price) || 0,
      credits_price: parseInt(creditsPrice) || 0,
      category_id: categoryId || null,
      images,
      is_active: isActive,
      inventory_count: type === 'product' ? (parseInt(inventoryCount) || null) : null,
      duration_minutes: type === 'service' ? (parseInt(durationMinutes) || null) : null,
      location: type === 'rental' ? (location.trim() || null) : null,
      amenities: type === 'rental' ? amenities : null,
      contact_email: type === 'rental' ? (contactEmail.trim() || null) : null,
      contact_phone: type === 'rental' ? (contactPhone.trim() || null) : null,
    };

    try {
      if (editItem) {
        await updateItem.mutateAsync({ id: editItem.id, ...itemData });
      } else {
        await createItem.mutateAsync(itemData);
      }
      onOpenChange(false);
      resetForm();
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editItem ? 'Edit Item' : 'Add New Item'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={type === opt.value ? 'default' : 'outline'}
                    className="flex flex-col h-auto py-3"
                    onClick={() => setType(opt.value as typeof type)}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <span className="text-xs">{opt.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Basic Info */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your item..."
              rows={3}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (USD)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credits">LC Credits</Label>
              <Input
                id="credits"
                type="number"
                min="0"
                value={creditsPrice}
                onChange={(e) => setCreditsPrice(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Type-specific fields */}
          {type === 'product' && (
            <div className="space-y-2">
              <Label htmlFor="inventory">Inventory Count</Label>
              <Input
                id="inventory"
                type="number"
                min="0"
                value={inventoryCount}
                onChange={(e) => setInventoryCount(e.target.value)}
                placeholder="Leave empty for unlimited"
              />
            </div>
          )}

          {type === 'service' && (
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="0"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="e.g., 60"
              />
            </div>
          )}

          {type === 'rental' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Downtown LA"
                />
              </div>

              <div className="space-y-2">
                <Label>Amenities</Label>
                <div className="flex gap-2">
                  <Input
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    placeholder="Add amenity"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                  />
                  <Button type="button" variant="outline" onClick={addAmenity}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {amenities.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {amenities.map((amenity) => (
                      <Badge key={amenity} variant="secondary" className="flex items-center gap-1">
                        {amenity}
                        <button type="button" onClick={() => removeAmenity(amenity)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Contact Email</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Contact Phone</Label>
                  <Input
                    id="contact-phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>
            </>
          )}

          {/* Images */}
          <div className="space-y-2">
            <Label>Images</Label>
            <div className="flex flex-wrap gap-2">
              {images.map((url, idx) => (
                <div key={idx} className="relative w-20 h-20">
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    onClick={() => removeImage(idx)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                />
                {isUploading ? (
                  <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                ) : (
                  <Upload className="w-5 h-5 text-muted-foreground" />
                )}
              </label>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="active">Active (visible in store)</Label>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={createItem.isPending || updateItem.isPending}>
              {editItem ? 'Update Item' : 'Add Item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
