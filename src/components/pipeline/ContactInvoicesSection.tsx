import { useState, useRef } from "react";
import { format } from "date-fns";
import { FileText, Plus, Trash2, Send, Loader2, Image, X, Mail, Phone, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useContactInvoices, ContactInvoice, InvoiceLineItem } from "@/hooks/useContactInvoices";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ContactInvoicesSectionProps {
  pipelineItemId: string;
  contactEmail?: string;
  contactPhone?: string;
}

export function ContactInvoicesSection({ pipelineItemId, contactEmail, contactPhone }: ContactInvoicesSectionProps) {
  const { user } = useAuth();
  const { invoices, isLoading, createInvoice, updateInvoice, sendInvoice, deleteInvoice, isCreating, isSending } = useContactInvoices(pipelineItemId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ContactInvoice | null>(null);
  const [sendVia, setSendVia] = useState<'email' | 'sms'>('email');
  const [sendRecipient, setSendRecipient] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newInvoice, setNewInvoice] = useState({
    title: '',
    description: '',
    line_items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }] as InvoiceLineItem[],
    attached_images: [] as string[],
    tax_rate: 0,
    currency: 'USD',
    due_date: '',
  });

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    const updated = [...newInvoice.line_items];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate total
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].total = Number(updated[index].quantity) * Number(updated[index].unit_price);
    }
    
    setNewInvoice({ ...newInvoice, line_items: updated });
  };

  const addLineItem = () => {
    setNewInvoice({
      ...newInvoice,
      line_items: [...newInvoice.line_items, { description: '', quantity: 1, unit_price: 0, total: 0 }],
    });
  };

  const removeLineItem = (index: number) => {
    if (newInvoice.line_items.length <= 1) return;
    setNewInvoice({
      ...newInvoice,
      line_items: newInvoice.line_items.filter((_, i) => i !== index),
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/invoices/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('contact-media')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('contact-media')
        .getPublicUrl(fileName);

      setNewInvoice({
        ...newInvoice,
        attached_images: [...newInvoice.attached_images, urlData.publicUrl],
      });
      toast.success("Image attached");
    } catch (error) {
      toast.error("Failed to upload image");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setNewInvoice({
      ...newInvoice,
      attached_images: newInvoice.attached_images.filter((_, i) => i !== index),
    });
  };

  const handleCreate = async () => {
    if (!newInvoice.title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (newInvoice.line_items.every(item => !item.description.trim())) {
      toast.error("At least one line item is required");
      return;
    }

    try {
      await createInvoice({
        title: newInvoice.title.trim(),
        description: newInvoice.description.trim() || undefined,
        line_items: newInvoice.line_items.filter(item => item.description.trim()),
        attached_images: newInvoice.attached_images,
        tax_rate: newInvoice.tax_rate,
        currency: newInvoice.currency,
        due_date: newInvoice.due_date || undefined,
        recipient_email: contactEmail,
        recipient_phone: contactPhone,
      });
      setIsDialogOpen(false);
      setNewInvoice({
        title: '',
        description: '',
        line_items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
        attached_images: [],
        tax_rate: 0,
        currency: 'USD',
        due_date: '',
      });
      toast.success("Invoice created");
    } catch (error) {
      toast.error("Failed to create invoice");
    }
  };

  const handleSend = async () => {
    if (!selectedInvoice || !sendRecipient.trim()) {
      toast.error("Recipient is required");
      return;
    }

    try {
      await sendInvoice({
        invoiceId: selectedInvoice.id,
        via: sendVia,
        recipient: sendRecipient.trim(),
        senderName: senderName.trim() || undefined,
        senderEmail: senderEmail.trim() || undefined,
      });
      setSendDialogOpen(false);
      setSelectedInvoice(null);
      setSenderName('');
      setSenderEmail('');
      toast.success(`Invoice sent via ${sendVia}`);
    } catch (error) {
      toast.error("Failed to send invoice");
    }
  };

  const handleMarkPaid = async (invoice: ContactInvoice) => {
    try {
      await updateInvoice({
        invoiceId: invoice.id,
        updates: { status: 'paid', paid_at: new Date().toISOString() },
      });
      toast.success("Invoice marked as paid");
    } catch (error) {
      toast.error("Failed to update invoice");
    }
  };

  const handleDelete = async (invoiceId: string) => {
    try {
      await deleteInvoice(invoiceId);
      toast.success("Invoice deleted");
    } catch (error) {
      toast.error("Failed to delete invoice");
    }
  };

  const subtotal = newInvoice.line_items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (newInvoice.tax_rate / 100);
  const total = subtotal + taxAmount;

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    sent: 'bg-blue-500/10 text-blue-500',
    paid: 'bg-green-500/10 text-green-500',
    overdue: 'bg-red-500/10 text-red-500',
    cancelled: 'bg-muted text-muted-foreground',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm text-foreground">Invoices</h3>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" role="button" aria-label="Create invoice">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-title">Title *</Label>
                <Input
                  id="invoice-title"
                  value={newInvoice.title}
                  onChange={(e) => setNewInvoice({ ...newInvoice, title: e.target.value })}
                  placeholder="e.g., Photography Services"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-description">Description</Label>
                <Textarea
                  id="invoice-description"
                  value={newInvoice.description}
                  onChange={(e) => setNewInvoice({ ...newInvoice, description: e.target.value })}
                  placeholder="Additional details..."
                />
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <Label>Line Items</Label>
                <div className="space-y-2">
                  {newInvoice.line_items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-16"
                      />
                      <Input
                        type="number"
                        placeholder="Price"
                        value={item.unit_price}
                        onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground w-16 text-right pt-2">
                        ${item.total.toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => removeLineItem(index)}
                        disabled={newInvoice.line_items.length <= 1}
                        role="button"
                        aria-label="Remove line item"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addLineItem} role="button">
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>
              </div>

              {/* Tax */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                  <Input
                    id="tax-rate"
                    type="number"
                    value={newInvoice.tax_rate}
                    onChange={(e) => setNewInvoice({ ...newInvoice, tax_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={newInvoice.currency} onValueChange={(v) => setNewInvoice({ ...newInvoice, currency: v })}>
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

              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="due-date">Due Date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={newInvoice.due_date}
                  onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                />
              </div>

              {/* Attached Images */}
              <div className="space-y-2">
                <Label>Attach Images</Label>
                <div className="flex flex-wrap gap-2">
                  {newInvoice.attached_images.map((url, index) => (
                    <div key={index} className="relative w-16 h-16">
                      <img src={url} alt="" className="w-full h-full object-cover rounded" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-5 w-5"
                        onClick={() => removeImage(index)}
                        role="button"
                        aria-label="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-16 h-16"
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    aria-label="Add image"
                  >
                    <Image className="w-5 h-5" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal, newInvoice.currency)}</span>
                </div>
                {newInvoice.tax_rate > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({newInvoice.tax_rate}%):</span>
                    <span>{formatCurrency(taxAmount, newInvoice.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base">
                  <span>Total:</span>
                  <span>{formatCurrency(total, newInvoice.currency)}</span>
                </div>
              </div>

              <Button onClick={handleCreate} disabled={isCreating} className="w-full" role="button">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Invoice"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : invoices.length === 0 ? (
        <div 
          className="text-center py-6 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsDialogOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setIsDialogOpen(true)}
        >
          <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Create an invoice</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{invoice.title}</span>
                    <Badge className={`${statusColors[invoice.status]} text-xs`}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{invoice.invoice_number}</p>
                  <p className="text-sm font-semibold mt-1">{formatCurrency(invoice.total, invoice.currency)}</p>
                  {invoice.due_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {invoice.status === 'draft' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setSendRecipient(contactEmail || contactPhone || '');
                        setSendVia(contactEmail ? 'email' : 'sms');
                        setSendDialogOpen(true);
                      }}
                      role="button"
                    >
                      <Send className="w-3 h-3 mr-1" /> Send
                    </Button>
                  )}
                  {invoice.status === 'sent' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleMarkPaid(invoice)}
                      role="button"
                    >
                      <Check className="w-3 h-3 mr-1" /> Mark Paid
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(invoice.id)}
                    role="button"
                    aria-label="Delete invoice"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Send Invoice Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Sender Info */}
            <div className="p-3 bg-muted/30 rounded-lg space-y-3">
              <p className="text-xs text-muted-foreground font-medium">Your Information (appears on invoice)</p>
              <div className="space-y-2">
                <Label htmlFor="sender-name">Your Name / Business Name</Label>
                <Input
                  id="sender-name"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g., John's Photography"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sender-email">Your Email (for replies)</Label>
                <Input
                  id="sender-email"
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="your@email.com"
                />
                <p className="text-xs text-muted-foreground">Clients will reply to this email address</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Send via</Label>
              <Select 
                value={sendVia} 
                onValueChange={(v) => {
                  const method = v as 'email' | 'sms';
                  setSendVia(method);
                  // Update recipient based on selected method
                  if (method === 'email') {
                    setSendRecipient(contactEmail || '');
                  } else {
                    setSendRecipient(contactPhone || '');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Email
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" /> SMS
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-recipient">{sendVia === 'email' ? 'Client Email Address' : 'Client Phone Number'}</Label>
              <Input
                id="send-recipient"
                type={sendVia === 'email' ? 'email' : 'tel'}
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
                placeholder={sendVia === 'email' ? 'client@example.com' : '+1234567890'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)} role="button">
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending} role="button">
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
