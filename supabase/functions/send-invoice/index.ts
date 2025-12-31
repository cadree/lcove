import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceId, via, recipient } = await req.json();

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

    const senderName = profile?.display_name || 'Your service provider';

    // Format line items for the message
    const lineItemsText = (invoice.line_items as any[])
      .map((item: any) => `- ${item.description}: $${item.total.toFixed(2)}`)
      .join('\n');

    const message = `
Invoice from ${senderName}

${invoice.title}
Invoice #: ${invoice.invoice_number}

Items:
${lineItemsText}

Subtotal: $${invoice.subtotal.toFixed(2)}
${invoice.tax_amount > 0 ? `Tax: $${invoice.tax_amount.toFixed(2)}` : ''}
Total: $${invoice.total.toFixed(2)}

${invoice.due_date ? `Due by: ${new Date(invoice.due_date).toLocaleDateString()}` : ''}

Thank you for your business!
    `.trim();

    if (via === 'email') {
      // Send via Resend
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        console.error('RESEND_API_KEY not configured');
        return new Response(
          JSON.stringify({ error: 'Email service not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'invoices@resend.dev',
          to: [recipient],
          subject: `Invoice ${invoice.invoice_number} from ${senderName}`,
          text: message,
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

      console.log('Email sent successfully');
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

      // Shorten message for SMS
      const smsMessage = `Invoice ${invoice.invoice_number} from ${senderName}. Total: $${invoice.total.toFixed(2)}. ${invoice.due_date ? `Due: ${new Date(invoice.due_date).toLocaleDateString()}` : ''}`;

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
