import { useState } from 'react';
import { StoreItem, useCreateRentalInquiry } from '@/hooks/useStore';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Package,
  Wrench,
  Building2,
  Coins,
  CreditCard,
  Clock,
  MapPin,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface StoreItemDialogProps {
  item: StoreItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeIcons = {
  product: Package,
  service: Wrench,
  rental: Building2,
};

export const StoreItemDialog = ({ item, open, onOpenChange }: StoreItemDialogProps) => {
  const { user } = useAuth();
  const { balance } = useCredits(user?.id);
  const createInquiry = useCreateRentalInquiry();
  const [currentImage, setCurrentImage] = useState(0);
  const [paymentType, setPaymentType] = useState<'cash' | 'credits'>('cash');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [preferredDates, setPreferredDates] = useState('');
  const [isPurchasing, setIsPurchasing] = useState(false);

  if (!item) return null;

  const TypeIcon = typeIcons[item.type];
  const store = item.store as StoreItem['store'];
  const profile = store?.profile;
  const images = item.images || [];
  const canPayWithCredits = item.credits_price > 0 && balance >= item.credits_price;

  const handlePurchase = async () => {
    if (!user) {
      toast.error('Please sign in to make a purchase');
      return;
    }

    setIsPurchasing(true);
    try {
      if (paymentType === 'credits') {
        // Handle credit payment via edge function
        const { data, error } = await supabase.functions.invoke('purchase-store-item', {
          body: { itemId: item.id, paymentType: 'credits' },
        });

        if (error) throw error;
        toast.success('Purchase successful!');
        onOpenChange(false);
      } else {
        // Handle cash payment via Stripe
        const { data, error } = await supabase.functions.invoke('purchase-store-item', {
          body: { itemId: item.id, paymentType: 'cash' },
        });

        if (error) throw error;
        if (data?.url) {
          window.open(data.url, '_blank');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Purchase failed');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleSendInquiry = async () => {
    if (!inquiryMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    await createInquiry.mutateAsync({
      item_id: item.id,
      message: inquiryMessage,
      preferred_dates: preferredDates || undefined,
    });

    setInquiryMessage('');
    setPreferredDates('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon className="w-5 h-5 text-primary" />
            {item.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image Gallery */}
          {images.length > 0 && (
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              <img
                src={images[currentImage]}
                alt={item.title}
                className="w-full h-full object-cover"
              />
              {images.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm"
                    onClick={() => setCurrentImage((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm"
                    onClick={() => setCurrentImage((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          idx === currentImage ? 'bg-primary' : 'bg-background/50'
                        }`}
                        onClick={() => setCurrentImage(idx)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Seller Info */}
          {profile && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar>
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback>{profile.display_name?.charAt(0) || '?'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{profile.display_name}</p>
                <p className="text-sm text-muted-foreground">{store?.name}</p>
              </div>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-muted-foreground whitespace-pre-wrap">{item.description}</p>
            </div>
          )}

          {/* Item Details */}
          <div className="grid grid-cols-2 gap-4">
            {item.category && (
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <Badge variant="outline">{item.category.name}</Badge>
              </div>
            )}
            {item.duration_minutes && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{item.duration_minutes} minutes</span>
              </div>
            )}
            {item.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{item.location}</span>
              </div>
            )}
            {item.type === 'product' && item.inventory_count !== null && (
              <div>
                <p className="text-sm text-muted-foreground">Availability</p>
                <Badge variant={item.inventory_count > 0 ? 'secondary' : 'destructive'}>
                  {item.inventory_count > 0 ? `${item.inventory_count} in stock` : 'Sold out'}
                </Badge>
              </div>
            )}
          </div>

          {/* Amenities for Rentals */}
          {item.type === 'rental' && item.amenities && item.amenities.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Amenities</h4>
              <div className="flex flex-wrap gap-2">
                {item.amenities.map((amenity, idx) => (
                  <Badge key={idx} variant="outline">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {amenity}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Contact Info for Rentals */}
          {item.type === 'rental' && (item.contact_email || item.contact_phone) && (
            <div className="space-y-2">
              <h4 className="font-medium">Contact</h4>
              {item.contact_email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${item.contact_email}`} className="text-primary hover:underline">
                    {item.contact_email}
                  </a>
                </div>
              )}
              {item.contact_phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${item.contact_phone}`} className="text-primary hover:underline">
                    {item.contact_phone}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Pricing */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Price</span>
              <div className="text-right">
                {item.price > 0 && (
                  <p className="text-2xl font-bold">${item.price.toFixed(2)}</p>
                )}
                {item.credits_price > 0 && (
                  <p className="text-primary flex items-center gap-1 justify-end">
                    <Coins className="w-4 h-4" />
                    {item.credits_price} LC Credits
                  </p>
                )}
                {item.price === 0 && item.credits_price === 0 && (
                  <p className="text-muted-foreground">Contact for pricing</p>
                )}
              </div>
            </div>

            {/* Purchase Options for Products/Services */}
            {item.type !== 'rental' && (item.price > 0 || item.credits_price > 0) && (
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex gap-2">
                  {item.price > 0 && (
                    <Button
                      variant={paymentType === 'cash' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setPaymentType('cash')}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Pay ${item.price}
                    </Button>
                  )}
                  {item.credits_price > 0 && (
                    <Button
                      variant={paymentType === 'credits' ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setPaymentType('credits')}
                      disabled={!canPayWithCredits}
                    >
                      <Coins className="w-4 h-4 mr-2" />
                      {item.credits_price} LC
                      {!canPayWithCredits && ' (Insufficient)'}
                    </Button>
                  )}
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handlePurchase}
                  disabled={isPurchasing || (item.type === 'product' && item.inventory_count === 0)}
                >
                  {isPurchasing ? 'Processing...' : 'Purchase Now'}
                </Button>
              </div>
            )}

            {/* Inquiry Form for Rentals */}
            {item.type === 'rental' && (
              <div className="space-y-3 pt-3 border-t border-border">
                <h4 className="font-medium flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Send an Inquiry
                </h4>
                <div className="space-y-2">
                  <Label htmlFor="preferred-dates">Preferred Dates (optional)</Label>
                  <Input
                    id="preferred-dates"
                    placeholder="e.g., Dec 20-22, flexible weekends"
                    value={preferredDates}
                    onChange={(e) => setPreferredDates(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inquiry-message">Message</Label>
                  <Textarea
                    id="inquiry-message"
                    placeholder="Tell the owner about your needs..."
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSendInquiry}
                  disabled={createInquiry.isPending}
                >
                  {createInquiry.isPending ? 'Sending...' : 'Send Inquiry'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
