import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Network, useContentGenres } from '@/hooks/useCinema';
import { Settings, Trash2, CreditCard, CheckCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

interface NetworkSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  network: Network;
}

interface ConnectStatus {
  hasAccount: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export const NetworkSettingsDialog = ({
  open,
  onOpenChange,
  network,
}: NetworkSettingsDialogProps) => {
  const [name, setName] = useState(network.name);
  const [description, setDescription] = useState(network.description || '');
  const [genre, setGenre] = useState(network.genre || '');
  const [isPublic, setIsPublic] = useState(network.is_public);
  const [isPaid, setIsPaid] = useState(network.is_paid);
  const [subscriptionPrice, setSubscriptionPrice] = useState(network.subscription_price.toString());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [loadingConnect, setLoadingConnect] = useState(false);
  const [settingUpPayout, setSettingUpPayout] = useState(false);

  const { data: genres = [] } = useContentGenres();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setName(network.name);
      setDescription(network.description || '');
      setGenre(network.genre || '');
      setIsPublic(network.is_public);
      setIsPaid(network.is_paid);
      setSubscriptionPrice(network.subscription_price.toString());
      checkConnectStatus();
    }
  }, [open, network]);

  const checkConnectStatus = async () => {
    setLoadingConnect(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('check-connect-status', {
        body: { networkId: network.id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setConnectStatus(data);
    } catch (error) {
      console.error('Error checking connect status:', error);
    } finally {
      setLoadingConnect(false);
    }
  };

  const handleSetupPayout = async () => {
    setSettingUpPayout(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('create-connect-account', {
        body: { networkId: network.id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success('Complete your payout setup in the new tab');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to start payout setup');
    } finally {
      setSettingUpPayout(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Network name is required');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('networks')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          genre: genre || null,
          is_public: isPublic,
          is_paid: isPaid,
          subscription_price: isPaid ? parseFloat(subscriptionPrice) : 0,
        })
        .eq('id', network.id);

      if (error) throw error;

      toast.success('Network settings updated');
      queryClient.invalidateQueries({ queryKey: ['network', network.id] });
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      queryClient.invalidateQueries({ queryKey: ['my-networks'] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);

    try {
      const { error } = await supabase
        .from('networks')
        .delete()
        .eq('id', network.id);

      if (error) throw error;

      toast.success('Network deleted');
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      queryClient.invalidateQueries({ queryKey: ['my-networks'] });
      onOpenChange(false);
      navigate('/cinema');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const isPayoutComplete = connectStatus?.hasAccount && 
    connectStatus?.chargesEnabled && 
    connectStatus?.payoutsEnabled && 
    connectStatus?.detailsSubmitted;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Network Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Network Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              rows={3}
            />
          </div>

          {/* Genre */}
          <div className="space-y-2">
            <Label>Primary Genre</Label>
            <Select value={genre || "none"} onValueChange={(v) => setGenre(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {genres.map((g) => (
                  <SelectItem key={g.id} value={g.name || `genre-${g.id}`}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label>Public Network</Label>
              <p className="text-sm text-muted-foreground">
                Make your network discoverable
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          {/* Monetization */}
          <div className="space-y-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Paid Subscription</Label>
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
                  You receive 80% of subscription revenue. 20% goes to platform fees.
                </p>
              </div>
            )}
          </div>

          {/* Payout Setup */}
          {isPaid && (
            <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <h4 className="font-medium">Payout Setup</h4>
              </div>
              
              {loadingConnect ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking payout status...
                </div>
              ) : isPayoutComplete ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Payouts are enabled! You'll receive 80% of subscription revenue.
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSetupPayout}
                    disabled={settingUpPayout}
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Manage Payout Settings
                  </Button>
                </div>
              ) : connectStatus?.hasAccount ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <AlertCircle className="w-4 h-4" />
                    Payout setup incomplete. Complete setup to receive payments.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!connectStatus.detailsSubmitted && (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        Details needed
                      </Badge>
                    )}
                    {!connectStatus.chargesEnabled && (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        Charges disabled
                      </Badge>
                    )}
                    {!connectStatus.payoutsEnabled && (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        Payouts disabled
                      </Badge>
                    )}
                  </div>
                  <Button
                    onClick={handleSetupPayout}
                    disabled={settingUpPayout}
                    className="gap-2"
                  >
                    {settingUpPayout ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    Complete Setup
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Connect your bank account or debit card to receive payments from subscribers.
                    You'll receive 80% of all subscription revenue.
                  </p>
                  <Button
                    onClick={handleSetupPayout}
                    disabled={settingUpPayout}
                    className="gap-2"
                  >
                    {settingUpPayout ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    Set Up Payouts
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          {/* Danger Zone */}
          <div className="border-t border-border pt-6">
            <h4 className="font-medium text-destructive mb-4">Danger Zone</h4>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete Network
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Network?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your network "{network.name}" and all its content.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};