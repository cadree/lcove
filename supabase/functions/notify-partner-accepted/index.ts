import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { requireUserOrService } from "../_shared/require-caller.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

function errorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PartnerAcceptedRequest {
  applicationId: string;
  email: string;
  businessName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = requireUserOrService(req, corsHeaders);
  if (denied) return denied;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { applicationId, email, businessName }: PartnerAcceptedRequest = await req.json();

    console.log(`Sending partner acceptance email to ${email} for ${businessName}`);

    // Validate required fields
    if (!email || !businessName) {
      throw new Error("Missing required fields: email and businessName");
    }

    const appUrl = Deno.env.get("SITE_URL") || "https://etherbylcove.com";
    const partnerPortalUrl = `${appUrl}/partner-portal`;

    const emailResponse = await resend.emails.send({
      from: "Ether by LCOVE <notifications@etherbylcove.com>",
      to: [email],
      subject: `🎉 Welcome to the Ether Partner Network, ${businessName}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Partner Application Accepted</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px;">Welcome to the Family! 🎉</h1>
            <p style="color: #a0a0a0; margin: 0; font-size: 16px;">Your partner application has been accepted</p>
          </div>
          
          <div style="background: #ffffff; border-radius: 12px; padding: 32px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <p style="font-size: 18px; margin: 0 0 16px 0;">Dear <strong>${businessName}</strong>,</p>
            
            <p style="margin: 0 0 16px 0;">We're thrilled to welcome you to the <strong>Ether Partner Network</strong>! Your application to join our creative community as a brand partner has been approved.</p>
            
            <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 8px; padding: 20px; margin: 24px 0;">
              <h3 style="margin: 0 0 12px 0; color: #1a1a2e;">🚀 What's Next?</h3>
              <ol style="margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;"><strong>Customize Your Profile</strong> - Add your logo, photos, and details</li>
                <li style="margin-bottom: 8px;"><strong>Set Your Exclusive Offer</strong> - Create a special deal for our members</li>
                <li style="margin-bottom: 8px;"><strong>Go Live</strong> - Once complete, your partnership will be visible to our community</li>
              </ol>
            </div>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${partnerPortalUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Customize Your Partner Profile →
              </a>
            </div>
            
            <p style="margin: 24px 0 0 0; font-size: 14px; color: #666;">
              If you have any questions about setting up your partner profile, feel free to reach out to our team. We're here to help you make the most of this partnership!
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">
              <strong>Ether by LCOVE</strong>
            </p>
            <p style="margin: 0; font-size: 12px; color: #999;">
              Empowering creators, connecting communities
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Partner acceptance email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    console.error("Error in notify-partner-accepted function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage(error) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
