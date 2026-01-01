import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContractData {
  id: string;
  contract_number: string;
  title: string;
  provider_name: string | null;
  provider_address: string | null;
  provider_email: string | null;
  provider_phone: string | null;
  client_name: string | null;
  client_address: string | null;
  client_email: string | null;
  client_phone: string | null;
  scope_description: string | null;
  deliverables: string | null;
  timeline_milestones: string | null;
  exclusions: string | null;
  revisions_included: number;
  revision_cost: number | null;
  total_price: number | null;
  payment_type: string | null;
  payment_schedule: string | null;
  payment_methods: string | null;
  late_fee_percentage: number | null;
  refund_policy: string | null;
  project_start_date: string | null;
  estimated_completion_date: string | null;
  client_responsibilities: string | null;
  ownership_before_payment: string | null;
  ownership_after_payment: string | null;
  portfolio_rights: boolean;
  confidentiality_enabled: boolean;
  confidentiality_duration: string | null;
  confidentiality_terms: string | null;
  termination_notice_days: number;
  termination_terms: string | null;
  early_termination_fee: number | null;
  limitation_of_liability: string | null;
  indemnification_terms: string | null;
  governing_law_state: string | null;
  governing_law_country: string;
  force_majeure_enabled: boolean;
  force_majeure_terms: string | null;
}

function generateContractHTML(contract: ContractData, signUrl: string): string {
  const formatDate = (date: string | null) => {
    if (!date) return 'TBD';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'TBD';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const paymentTypeLabels: Record<string, string> = {
    flat_fee: 'Flat Fee',
    hourly: 'Hourly Rate',
    retainer: 'Retainer',
    milestone: 'Milestone-Based',
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${contract.title}</title>
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
        h1 { font-size: 28px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        h2 { font-size: 18px; color: #555; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .contract-number { color: #888; font-size: 14px; }
        .party-box { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .party-box h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; text-transform: uppercase; }
        .section-content { margin: 10px 0; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .highlight { background: #fffbeb; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; }
        .sign-button { display: inline-block; background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
        .sign-button:hover { background: #1d4ed8; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #888; }
      </style>
    </head>
    <body>
      <h1>${contract.title}</h1>
      <p class="contract-number">Contract #${contract.contract_number}</p>

      <h2>1. Parties Involved</h2>
      <div class="grid-2">
        <div class="party-box">
          <h3>Service Provider</h3>
          <p><strong>${contract.provider_name || 'Not specified'}</strong></p>
          ${contract.provider_address ? `<p>${contract.provider_address}</p>` : ''}
          ${contract.provider_email ? `<p>Email: ${contract.provider_email}</p>` : ''}
          ${contract.provider_phone ? `<p>Phone: ${contract.provider_phone}</p>` : ''}
        </div>
        <div class="party-box">
          <h3>Client</h3>
          <p><strong>${contract.client_name || 'Not specified'}</strong></p>
          ${contract.client_address ? `<p>${contract.client_address}</p>` : ''}
          ${contract.client_email ? `<p>Email: ${contract.client_email}</p>` : ''}
          ${contract.client_phone ? `<p>Phone: ${contract.client_phone}</p>` : ''}
        </div>
      </div>

      ${contract.scope_description || contract.deliverables ? `
        <h2>2. Scope of Work</h2>
        ${contract.scope_description ? `<div class="section-content"><strong>Description:</strong><p>${contract.scope_description}</p></div>` : ''}
        ${contract.deliverables ? `<div class="section-content"><strong>Deliverables:</strong><p>${contract.deliverables}</p></div>` : ''}
        ${contract.timeline_milestones ? `<div class="section-content"><strong>Milestones:</strong><p>${contract.timeline_milestones}</p></div>` : ''}
        ${contract.exclusions ? `<div class="section-content"><strong>Exclusions:</strong><p>${contract.exclusions}</p></div>` : ''}
        <div class="section-content">
          <strong>Revisions:</strong> ${contract.revisions_included} included${contract.revision_cost ? `, additional revisions at ${formatCurrency(contract.revision_cost)} each` : ''}
        </div>
      ` : ''}

      ${contract.total_price ? `
        <h2>3. Payment Terms</h2>
        <div class="highlight">
          <p><strong>Total Price:</strong> ${formatCurrency(contract.total_price)}</p>
          ${contract.payment_type ? `<p><strong>Payment Type:</strong> ${paymentTypeLabels[contract.payment_type] || contract.payment_type}</p>` : ''}
          ${contract.payment_schedule ? `<p><strong>Schedule:</strong> ${contract.payment_schedule}</p>` : ''}
          ${contract.payment_methods ? `<p><strong>Accepted Methods:</strong> ${contract.payment_methods}</p>` : ''}
          ${contract.late_fee_percentage ? `<p><strong>Late Fee:</strong> ${contract.late_fee_percentage}% per month</p>` : ''}
          ${contract.refund_policy ? `<p><strong>Refund Policy:</strong> ${contract.refund_policy}</p>` : ''}
        </div>
      ` : ''}

      ${contract.project_start_date || contract.estimated_completion_date ? `
        <h2>4. Timeline</h2>
        <div class="section-content">
          <p><strong>Start Date:</strong> ${formatDate(contract.project_start_date)}</p>
          <p><strong>Estimated Completion:</strong> ${formatDate(contract.estimated_completion_date)}</p>
          ${contract.client_responsibilities ? `<p><strong>Client Responsibilities:</strong> ${contract.client_responsibilities}</p>` : ''}
        </div>
      ` : ''}

      <h2>5. Ownership & Intellectual Property</h2>
      <div class="section-content">
        <p><strong>Before Payment:</strong> ${contract.ownership_before_payment || 'Provider retains ownership until paid in full'}</p>
        <p><strong>After Payment:</strong> ${contract.ownership_after_payment || 'Client receives full rights after payment'}</p>
        <p><strong>Portfolio Rights:</strong> ${contract.portfolio_rights ? 'Provider may use work in portfolio' : 'Provider may not use work in portfolio'}</p>
      </div>

      ${contract.confidentiality_enabled ? `
        <h2>6. Confidentiality</h2>
        <div class="section-content">
          ${contract.confidentiality_duration ? `<p><strong>Duration:</strong> ${contract.confidentiality_duration}</p>` : ''}
          ${contract.confidentiality_terms ? `<p>${contract.confidentiality_terms}</p>` : '<p>Both parties agree to keep confidential information private.</p>'}
        </div>
      ` : ''}

      <h2>7. Termination</h2>
      <div class="section-content">
        <p><strong>Notice Period:</strong> ${contract.termination_notice_days} days</p>
        ${contract.early_termination_fee ? `<p><strong>Early Termination Fee:</strong> ${formatCurrency(contract.early_termination_fee)}</p>` : ''}
        ${contract.termination_terms ? `<p>${contract.termination_terms}</p>` : ''}
      </div>

      ${contract.limitation_of_liability || contract.indemnification_terms ? `
        <h2>8. Legal Terms</h2>
        <div class="section-content">
          ${contract.limitation_of_liability ? `<p><strong>Limitation of Liability:</strong> ${contract.limitation_of_liability}</p>` : ''}
          ${contract.indemnification_terms ? `<p><strong>Indemnification:</strong> ${contract.indemnification_terms}</p>` : ''}
          <p><strong>Governing Law:</strong> ${contract.governing_law_state ? `${contract.governing_law_state}, ` : ''}${contract.governing_law_country}</p>
        </div>
      ` : ''}

      ${contract.force_majeure_enabled ? `
        <h2>9. Force Majeure</h2>
        <div class="section-content">
          <p>${contract.force_majeure_terms || 'Neither party shall be liable for delays caused by circumstances beyond their reasonable control.'}</p>
        </div>
      ` : ''}

      <h2>Signatures</h2>
      <div class="section-content">
        <p>This contract constitutes the entire agreement between the parties.</p>
        <p>By signing below, both parties agree to the terms and conditions outlined in this contract.</p>
      </div>

      <div style="text-align: center; margin-top: 40px;">
        <a href="${signUrl}" class="sign-button">Review & Sign Contract</a>
      </div>

      <div class="footer">
        <p>This contract was generated and sent via Ether. Contract #${contract.contract_number}</p>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contractId, via, recipient } = await req.json();

    console.log(`Sending contract ${contractId} via ${via} to ${recipient}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch contract
    const { data: contract, error: contractError } = await supabase
      .from("contact_contracts")
      .select("*")
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
      console.error("Contract not found:", contractError);
      return new Response(JSON.stringify({ error: "Contract not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate signing URL (this would link to your app's signing page)
    const appUrl = Deno.env.get("APP_URL") || "https://ether.app";
    const signUrl = `${appUrl}/sign-contract/${contract.id}`;

    if (via === "email") {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        console.error("RESEND_API_KEY not configured");
        return new Response(JSON.stringify({ error: "Email not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resend = new Resend(resendApiKey);
      const html = generateContractHTML(contract as ContractData, signUrl);

      const emailResponse = await resend.emails.send({
        from: `${contract.provider_name || 'Contract'} <onboarding@resend.dev>`,
        to: [recipient],
        subject: `Contract: ${contract.title}`,
        html,
        reply_to: contract.provider_email || undefined,
      });

      console.log("Email sent:", emailResponse);
    } else if (via === "sms") {
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        console.error("Twilio not configured");
        return new Response(JSON.stringify({ error: "SMS not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Format phone number
      let formattedPhone = recipient.replace(/\D/g, "");
      if (!formattedPhone.startsWith("1") && formattedPhone.length === 10) {
        formattedPhone = "1" + formattedPhone;
      }
      if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+" + formattedPhone;
      }

      const message = `New contract from ${contract.provider_name || 'a provider'}: "${contract.title}"${contract.total_price ? ` - $${contract.total_price.toLocaleString()}` : ''}. Review and sign: ${signUrl}`;

      const formData = new URLSearchParams();
      formData.append("To", formattedPhone);
      formData.append("From", twilioPhoneNumber);
      formData.append("Body", message);

      const smsResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        }
      );

      const smsData = await smsResponse.text();
      console.log(`SMS response (${smsResponse.status}):`, smsData);

      if (!smsResponse.ok) {
        console.error("SMS failed:", smsData);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending contract:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
