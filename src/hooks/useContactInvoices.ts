import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Json } from "@/integrations/supabase/types";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ContactInvoice {
  id: string;
  pipeline_item_id: string;
  owner_user_id: string;
  invoice_number: string;
  title: string;
  description: string | null;
  line_items: InvoiceLineItem[];
  attached_images: string[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  sent_via: 'email' | 'sms' | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  created_at: string;
  updated_at: string;
}

function parseLineItems(data: Json | null): InvoiceLineItem[] {
  if (!data || !Array.isArray(data)) return [];
  return data.map(item => {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      return {
        description: String((item as Record<string, Json>).description || ''),
        quantity: Number((item as Record<string, Json>).quantity || 0),
        unit_price: Number((item as Record<string, Json>).unit_price || 0),
        total: Number((item as Record<string, Json>).total || 0),
      };
    }
    return { description: '', quantity: 0, unit_price: 0, total: 0 };
  });
}

export function useContactInvoices(pipelineItemId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['contact-invoices', pipelineItemId],
    queryFn: async () => {
      if (!pipelineItemId) return [];
      const { data, error } = await supabase
        .from('contact_invoices')
        .select('*')
        .eq('pipeline_item_id', pipelineItemId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(inv => ({
        ...inv,
        line_items: parseLineItems(inv.line_items as Json),
        attached_images: inv.attached_images || [],
        status: inv.status as ContactInvoice['status'],
        sent_via: inv.sent_via as ContactInvoice['sent_via'],
      })) as ContactInvoice[];
    },
    enabled: !!user && !!pipelineItemId,
  });

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}${month}-${random}`;
  };

  const createInvoice = useMutation({
    mutationFn: async (invoice: {
      title: string;
      description?: string;
      line_items: InvoiceLineItem[];
      attached_images?: string[];
      tax_rate?: number;
      currency?: string;
      due_date?: string;
      recipient_email?: string;
      recipient_phone?: string;
    }) => {
      if (!user || !pipelineItemId) throw new Error("Not authenticated");

      const subtotal = invoice.line_items.reduce((sum, item) => sum + item.total, 0);
      const taxRate = invoice.tax_rate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      const { data, error } = await supabase
        .from('contact_invoices')
        .insert({
          pipeline_item_id: pipelineItemId,
          owner_user_id: user.id,
          invoice_number: generateInvoiceNumber(),
          title: invoice.title,
          description: invoice.description || null,
          line_items: invoice.line_items as unknown as Json,
          attached_images: invoice.attached_images || [],
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          currency: invoice.currency || 'USD',
          due_date: invoice.due_date || null,
          recipient_email: invoice.recipient_email || null,
          recipient_phone: invoice.recipient_phone || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-invoices', pipelineItemId] });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ invoiceId, updates }: { invoiceId: string; updates: Partial<ContactInvoice> }) => {
      // Recalculate totals if line items changed
      let calculatedUpdates: Record<string, unknown> = { ...updates };
      if (updates.line_items) {
        const subtotal = updates.line_items.reduce((sum, item) => sum + item.total, 0);
        const taxRate = updates.tax_rate ?? 0;
        const taxAmount = subtotal * (taxRate / 100);
        calculatedUpdates = {
          ...updates,
          line_items: updates.line_items as unknown as Json,
          subtotal,
          tax_amount: taxAmount,
          total: subtotal + taxAmount,
        };
      }

      const { error } = await supabase
        .from('contact_invoices')
        .update({ ...calculatedUpdates, updated_at: new Date().toISOString() })
        .eq('id', invoiceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-invoices', pipelineItemId] });
    },
  });

  const sendInvoice = useMutation({
    mutationFn: async ({ invoiceId, via, recipient, senderName, senderEmail }: { 
      invoiceId: string; 
      via: 'email' | 'sms'; 
      recipient: string;
      senderName?: string;
      senderEmail?: string;
    }) => {
      // Update invoice status to sent
      const { error } = await supabase
        .from('contact_invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_via: via,
          [via === 'email' ? 'recipient_email' : 'recipient_phone']: recipient,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);
      
      if (error) throw error;

      // Call edge function to actually send the invoice
      const { error: sendError } = await supabase.functions.invoke('send-invoice', {
        body: { invoiceId, via, recipient, senderName, senderEmail },
      });
      
      if (sendError) {
        console.error('Failed to send invoice:', sendError);
        // Don't throw - the status was updated, just log the error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-invoices', pipelineItemId] });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('contact_invoices')
        .delete()
        .eq('id', invoiceId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-invoices', pipelineItemId] });
    },
  });

  return {
    invoices,
    isLoading,
    createInvoice: createInvoice.mutateAsync,
    updateInvoice: updateInvoice.mutateAsync,
    sendInvoice: sendInvoice.mutateAsync,
    deleteInvoice: deleteInvoice.mutateAsync,
    isCreating: createInvoice.isPending,
    isSending: sendInvoice.isPending,
  };
}
