import { useState } from "react";
import { format } from "date-fns";
import { DollarSign, Plus, Trash2, CheckCircle, XCircle, Clock, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContactQuotes, ContactQuote } from "@/hooks/useContactQuotes";
import { toast } from "sonner";

interface ContactQuotesSectionProps {
  pipelineItemId: string;
}

export function ContactQuotesSection({ pipelineItemId }: ContactQuotesSectionProps) {
  const { quotes, isLoading, createQuote, updateQuote, deleteQuote, isCreating } = useContactQuotes(pipelineItemId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newQuote, setNewQuote] = useState({
    title: '',
    description: '',
    amount: '',
    currency: 'USD',
  });

  const handleCreate = async () => {
    if (!newQuote.title.trim() || !newQuote.amount) {
      toast.error("Title and amount are required");
      return;
    }

    try {
      await createQuote({
        title: newQuote.title.trim(),
        description: newQuote.description.trim() || undefined,
        amount: parseFloat(newQuote.amount),
        currency: newQuote.currency,
      });
      setIsDialogOpen(false);
      setNewQuote({ title: '', description: '', amount: '', currency: 'USD' });
      toast.success("Quote added");
    } catch (error) {
      toast.error("Failed to add quote");
    }
  };

  const handleStatusChange = async (quote: ContactQuote, status: ContactQuote['status']) => {
    try {
      await updateQuote({ quoteId: quote.id, updates: { status } });
      toast.success(`Quote marked as ${status}`);
    } catch (error) {
      toast.error("Failed to update quote");
    }
  };

  const handleDelete = async (quoteId: string) => {
    try {
      await deleteQuote(quoteId);
      toast.success("Quote deleted");
    } catch (error) {
      toast.error("Failed to delete quote");
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    sent: 'bg-blue-500/10 text-blue-500',
    accepted: 'bg-green-500/10 text-green-500',
    rejected: 'bg-red-500/10 text-red-500',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    draft: <Clock className="w-3 h-3" />,
    sent: <Send className="w-3 h-3" />,
    accepted: <CheckCircle className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const totalQuoted = quotes.reduce((sum, q) => sum + q.amount, 0);
  const acceptedTotal = quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + q.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm text-foreground">Quotes & Pricing</h3>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" role="button" aria-label="Add quote">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Quote</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quote-title">Title *</Label>
                <Input
                  id="quote-title"
                  value={newQuote.title}
                  onChange={(e) => setNewQuote({ ...newQuote, title: e.target.value })}
                  placeholder="e.g., Photography Package"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-description">Description</Label>
                <Textarea
                  id="quote-description"
                  value={newQuote.description}
                  onChange={(e) => setNewQuote({ ...newQuote, description: e.target.value })}
                  placeholder="What's included..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="quote-amount">Amount *</Label>
                  <Input
                    id="quote-amount"
                    type="number"
                    value={newQuote.amount}
                    onChange={(e) => setNewQuote({ ...newQuote, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={newQuote.currency} onValueChange={(v) => setNewQuote({ ...newQuote, currency: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreate} disabled={isCreating} className="w-full" role="button">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Quote"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      {quotes.length > 0 && (
        <div className="flex gap-4 mb-3 text-xs">
          <div className="text-muted-foreground">
            Total: <span className="text-foreground font-medium">{formatCurrency(totalQuoted, 'USD')}</span>
          </div>
          <div className="text-muted-foreground">
            Accepted: <span className="text-green-500 font-medium">{formatCurrency(acceptedTotal, 'USD')}</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : quotes.length === 0 ? (
        <div 
          className="text-center py-6 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsDialogOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setIsDialogOpen(true)}
        >
          <DollarSign className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Add quotes for this client</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map((quote) => (
            <div
              key={quote.id}
              className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{quote.title}</span>
                    <Badge className={`${statusColors[quote.status]} text-xs`}>
                      {statusIcons[quote.status]}
                      <span className="ml-1">{quote.status}</span>
                    </Badge>
                  </div>
                  {quote.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{quote.description}</p>
                  )}
                  <p className="text-sm font-semibold mt-1">{formatCurrency(quote.amount, quote.currency)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Select value={quote.status} onValueChange={(v) => handleStatusChange(quote, v as ContactQuote['status'])}>
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(quote.id)}
                    role="button"
                    aria-label="Delete quote"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
