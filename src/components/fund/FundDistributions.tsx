import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, DollarSign, ExternalLink, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useCreateDistribution, 
  useDeleteDistribution, 
  useFundDistributions,
  type FundCategory 
} from '@/hooks/useFundDistributions';
import { useUserIsAdmin } from '@/hooks/useUserIsAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

const CATEGORY_OPTIONS: { value: FundCategory; label: string; color: string }[] = [
  { value: 'community_grants', label: 'Community Grants', color: 'hsl(330, 100%, 71%)' },
  { value: 'events_activations', label: 'Events & Activations', color: 'hsl(30, 30%, 50%)' },
  { value: 'education', label: 'Education', color: 'hsl(30, 30%, 65%)' },
  { value: 'infrastructure', label: 'Infrastructure', color: 'hsl(30, 30%, 40%)' },
  { value: 'operations', label: 'Operations', color: 'hsl(30, 20%, 55%)' },
];

export function AddDistributionDialog() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FundCategory>('community_grants');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [distributedAt, setDistributedAt] = useState(new Date().toISOString().split('T')[0]);

  const { mutate: createDistribution, isPending } = useCreateDistribution();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createDistribution({
      category,
      amount: parseFloat(amount),
      title,
      description: description || undefined,
      recipient_name: recipientName || undefined,
      proof_url: proofUrl || undefined,
      distributed_at: new Date(distributedAt).toISOString(),
    }, {
      onSuccess: () => {
        setOpen(false);
        setCategory('community_grants');
        setAmount('');
        setTitle('');
        setDescription('');
        setRecipientName('');
        setProofUrl('');
        setDistributedAt(new Date().toISOString().split('T')[0]);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Record Distribution
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Fund Distribution</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as FundCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: opt.color }}
                        />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="500.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="e.g., Photography Grant - Summer 2025"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Details about this distribution..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Recipient Name (optional)</Label>
              <Input
                placeholder="Artist or organization name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Distribution Date</Label>
              <Input
                type="date"
                value={distributedAt}
                onChange={(e) => setDistributedAt(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Proof URL (optional)</Label>
            <Input
              type="url"
              placeholder="https://..."
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Recording...' : 'Record Distribution'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DistributionsList() {
  const { user } = useAuth();
  const { data: distributions, isLoading } = useFundDistributions();
  const { mutate: deleteDistribution } = useDeleteDistribution();
  const { data: isAdmin } = useUserIsAdmin(user?.id);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!distributions?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No distributions recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
      {distributions.map((dist, index) => {
        const categoryInfo = CATEGORY_OPTIONS.find(c => c.value === dist.category);
        
        return (
          <motion.div
            key={dist.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-4 p-4 rounded-xl bg-background/50 border border-border/50"
          >
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${categoryInfo?.color}20` }}
            >
              <DollarSign className="w-5 h-5" style={{ color: categoryInfo?.color }} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="font-medium text-foreground truncate">{dist.title}</h4>
                <Badge 
                  variant="secondary" 
                  className="text-xs shrink-0"
                  style={{ 
                    backgroundColor: `${categoryInfo?.color}20`,
                    color: categoryInfo?.color 
                  }}
                >
                  {categoryInfo?.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {dist.recipient_name && (
                  <span>To: {dist.recipient_name}</span>
                )}
                <span>•</span>
                <span>{format(new Date(dist.distributed_at), 'MMM d, yyyy')}</span>
                {dist.proof_url && (
                  <>
                    <span>•</span>
                    <a 
                      href={dist.proof_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      Proof <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="font-bold text-foreground">
                ${Number(dist.amount).toLocaleString()}
              </p>
            </div>

            {isAdmin && (
              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => deleteDistribution(dist.id)}
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

export function RecentDistributionsCard({ recentDistributions }: { 
  recentDistributions?: Array<{
    id: string;
    category: string;
    amount: number;
    title: string;
    recipient_name: string | null;
    distributed_at: string;
  }> 
}) {
  const { user } = useAuth();
  const { data: isAdmin } = useUserIsAdmin(user?.id);

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-serif flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Recent Distributions
        </CardTitle>
        {isAdmin && <AddDistributionDialog />}
      </CardHeader>
      <CardContent>
        {!recentDistributions?.length ? (
          <p className="text-muted-foreground text-center py-4">
            No distributions recorded yet. {isAdmin && 'Use the button above to record fund usage.'}
          </p>
        ) : (
          <div className="space-y-3">
            {recentDistributions.map((dist, index) => {
              const categoryInfo = CATEGORY_OPTIONS.find(c => c.value === dist.category);
              
              return (
                <motion.div
                  key={dist.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-background/50"
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${categoryInfo?.color}20` }}
                  >
                    <DollarSign className="w-4 h-4" style={{ color: categoryInfo?.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{dist.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {dist.recipient_name || categoryInfo?.label} • {format(new Date(dist.distributed_at), 'MMM d')}
                    </p>
                  </div>
                  <p className="font-bold text-foreground shrink-0">
                    ${Number(dist.amount).toLocaleString()}
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
