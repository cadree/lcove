import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

function generateInvoiceHTML(invoice: any, senderName: string, senderEmail: string): string {
  const lineItems = (invoice.line_items as LineItem[]) || [];
  const attachedImages = (invoice.attached_images as string[]) || [];
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.currency || 'USD',
    }).format(amount);
  };

  const lineItemsHTML = lineItems.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">${formatCurrency(item.total)}</td>
    </tr>
  `).join('');

  const imagesHTML = attachedImages.length > 0 ? `
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 15px; color: #374151;">Attached Images</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 10px;">
        ${attachedImages.map(url => `
          <img src="${url}" alt="Invoice attachment" style="max-width: 200px; max-height: 200px; border-radius: 8px; object-fit: cover; border: 1px solid #e5e7eb;" />
        `).join('')}
      </div>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice ${invoice.invoice_number}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;">
  <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px 40px; color: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1 style="margin: 0 0 5px 0; font-size: 28px; font-weight: 700;">INVOICE</h1>
          <p style="margin: 0; opacity: 0.8; font-size: 14px;">${invoice.invoice_number}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-weight: 600; font-size: 16px;">${senderName}</p>
          <p style="margin: 5px 0 0 0; opacity: 0.8; font-size: 14px;">${senderEmail}</p>
        </div>
      </div>
    </div>

    <!-- Invoice Details -->
    <div style="padding: 30px 40px;">
      
      <!-- Title and Date -->
      <div style="margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #111827;">${invoice.title}</h2>
          ${invoice.description ? `<p style="margin: 0; color: #6b7280; font-size: 14px;">${invoice.description}</p>` : ''}
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 14px; color: #6b7280;">Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
          ${invoice.due_date ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: #dc2626; font-weight: 500;">Due: ${new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>` : ''}
        </div>
      </div>

      <!-- Total Banner -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px; padding: 20px 25px; margin-bottom: 30px; color: #ffffff;">
        <p style="margin: 0 0 5px 0; font-size: 14px; opacity: 0.9;">Total Amount</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700;">${formatCurrency(invoice.total)}</p>
      </div>

      <!-- Line Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
            <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Rate</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
            <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHTML}
        </tbody>
      </table>

      <!-- Totals -->
      <div style="margin-left: auto; max-width: 250px;">
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="color: #6b7280;">Subtotal</span>
          <span style="font-weight: 500;">${formatCurrency(invoice.subtotal)}</span>
        </div>
        ${invoice.tax_amount > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="color: #6b7280;">Tax (${invoice.tax_rate}%)</span>
          <span style="font-weight: 500;">${formatCurrency(invoice.tax_amount)}</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 18px; font-weight: 700; color: #111827;">
          <span>Total</span>
          <span>${formatCurrency(invoice.total)}</span>
        </div>
      </div>

      <!-- Attached Images -->
      ${imagesHTML}

    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">Thank you for your business!</p>
      <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">This invoice was sent from ${senderName}</p>
    </div>

  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceId, via, recipient, senderName: customSenderName, senderEmail: customSenderEmail } = await req.json();

    console.log(`Sending invoice ${invoiceId} via ${via} to ${recipient}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice details
    const { data: invoice, error: fetchError } = await supabase
      .from('contact_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      console.error('Invoice not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get owner profile for sender info
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', invoice.owner_user_id)
      .single();

    const senderName = customSenderName || profile?.display_name || 'Your service provider';
    const senderEmail = customSenderEmail || 'notifications@etherbylcove.com';

    if (via === 'email') {
      // Send via Resend with HTML invoice
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        console.error('RESEND_API_KEY not configured');
        return new Response(
          JSON.stringify({ error: 'Email service not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const invoiceHTML = generateInvoiceHTML(invoice, senderName, senderEmail);

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: `${senderName} <notifications@etherbylcove.com>`,
          reply_to: senderEmail !== 'notifications@etherbylcove.com' ? senderEmail : undefined,
          to: [recipient],
          subject: `Invoice ${invoice.invoice_number} - ${invoice.title}`,
          html: invoiceHTML,
        }),
      });

      if (!emailRes.ok) {
        const errorText = await emailRes.text();
        console.error('Failed to send email:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to send email' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Email sent successfully with HTML invoice');
    } else if (via === 'sms') {
      // Send via Twilio
      const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        console.error('Twilio not configured');
        return new Response(
          JSON.stringify({ error: 'SMS service not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Format line items for SMS
      const lineItems = (invoice.line_items as LineItem[]) || [];
      const itemsList = lineItems.map(item => `• ${item.description}: $${item.total.toFixed(2)}`).join('\n');

      const smsMessage = `Invoice from ${senderName}

${invoice.title}
Invoice #: ${invoice.invoice_number}

${itemsList}

Total: $${invoice.total.toFixed(2)}
${invoice.due_date ? `Due: ${new Date(invoice.due_date).toLocaleDateString()}` : ''}

Thank you for your business!`;

      const smsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          },
          body: new URLSearchParams({
            To: recipient,
            From: twilioPhoneNumber,
            Body: smsMessage,
          }),
        }
      );

      if (!smsRes.ok) {
        const errorText = await smsRes.text();
        console.error('Failed to send SMS:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to send SMS' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('SMS sent successfully');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-invoice function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
