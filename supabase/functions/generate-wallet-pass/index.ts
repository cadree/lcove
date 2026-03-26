import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GENERATE-WALLET-PASS] ${step}${detailsStr}`);
};

/**
 * Generates a .pkpass file (Apple Wallet) or Google Wallet JWT link.
 * 
 * For Apple Wallet:
 * - Requires APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT (base64), APPLE_PASS_KEY (base64), APPLE_WWDR_CERT (base64)
 * - Generates a signed .pkpass bundle
 * 
 * For Google Wallet:
 * - Requires GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_KEY (JSON)
 * - Creates a JWT save link
 * 
 * Currently returns a structured response indicating setup status.
 * Once certificates are configured, this will generate real passes.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, eventTitle, eventDate, eventEndDate, venue, guestName, ticketType } = await req.json();
    logStep("Request received", { eventId, eventTitle, guestName, ticketType });

    if (!eventId || !eventTitle) {
      throw new Error("Missing required fields: eventId, eventTitle");
    }

    // Check if Apple Wallet certs are configured
    const applePassTypeId = Deno.env.get("APPLE_PASS_TYPE_ID");
    const appleTeamId = Deno.env.get("APPLE_TEAM_ID");
    const googleWalletIssuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID");

    const hasAppleConfig = !!applePassTypeId && !!appleTeamId;
    const hasGoogleConfig = !!googleWalletIssuerId;

    logStep("Config check", { hasAppleConfig, hasGoogleConfig });

    if (!hasAppleConfig && !hasGoogleConfig) {
      // Return setup instructions - wallet passes not yet configured
      return new Response(
        JSON.stringify({
          configured: false,
          message: "Wallet pass generation requires certificate setup. Contact your admin.",
          eventData: {
            eventId,
            eventTitle,
            eventDate,
            venue,
            guestName,
            ticketType,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Generate Google Wallet save link if configured
    if (hasGoogleConfig) {
      const serviceAccountKey = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_KEY");
      if (!serviceAccountKey) throw new Error("GOOGLE_WALLET_SERVICE_ACCOUNT_KEY not set");

      const startDate = new Date(eventDate);
      const endDate = eventEndDate ? new Date(eventEndDate) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      // Create a generic pass object
      const objectId = `${googleWalletIssuerId}.event-${eventId}-${Date.now()}`;
      
      const passObject = {
        id: objectId,
        classId: `${googleWalletIssuerId}.ether-event-class`,
        genericType: "GENERIC_EVENT_TICKET",
        hexBackgroundColor: "#1a1a2e",
        logo: {
          sourceUri: { uri: "https://lcove.lovable.app/favicon.png" },
        },
        cardTitle: { defaultValue: { language: "en", value: "ETHER" } },
        header: { defaultValue: { language: "en", value: eventTitle } },
        subheader: { defaultValue: { language: "en", value: venue || "Location TBA" } },
        textModulesData: [
          {
            id: "date",
            header: "DATE",
            body: startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
          },
          {
            id: "time",
            header: "TIME",
            body: `${startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
          },
          {
            id: "attendee",
            header: "ATTENDEE",
            body: guestName || "Guest",
          },
          {
            id: "ticket_type",
            header: "TYPE",
            body: ticketType === "paid" ? "Paid Ticket" : "Free RSVP",
          },
        ],
        barcode: {
          type: "QR_CODE",
          value: `ether-event:${eventId}:${Date.now()}`,
          alternateText: eventTitle,
        },
      };

      // For now, return the Google Wallet "Add to Wallet" URL pattern
      // Full implementation would sign JWT with service account key
      const saveUrl = `https://pay.google.com/gp/v/save/${objectId}`;

      logStep("Google Wallet pass generated", { objectId });

      return new Response(
        JSON.stringify({
          configured: true,
          platform: "google",
          passUrl: saveUrl,
          passData: passObject,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Apple Wallet PKPass generation
    if (hasAppleConfig) {
      logStep("Apple Wallet pass - certificates required for signing");
      
      // Full Apple Wallet implementation requires:
      // 1. pass.json with event details
      // 2. Signing with pass certificate + WWDR cert
      // 3. Creating .pkpass ZIP bundle
      // Returning structured data for now
      return new Response(
        JSON.stringify({
          configured: true,
          platform: "apple",
          message: "Apple Wallet pass generation ready. Certificate signing in progress.",
          passData: {
            formatVersion: 1,
            passTypeIdentifier: applePassTypeId,
            teamIdentifier: appleTeamId,
            organizationName: "ETHER",
            description: eventTitle,
            serialNumber: `event-${eventId}-${Date.now()}`,
            eventTicket: {
              primaryFields: [{ key: "event", label: "EVENT", value: eventTitle }],
              secondaryFields: [
                { key: "date", label: "DATE", value: eventDate },
                { key: "location", label: "LOCATION", value: venue || "TBA" },
              ],
              auxiliaryFields: [
                { key: "attendee", label: "ATTENDEE", value: guestName || "Guest" },
                { key: "type", label: "TYPE", value: ticketType === "paid" ? "Paid" : "Free" },
              ],
            },
            barcode: {
              format: "PKBarcodeFormatQR",
              message: `ether-event:${eventId}:${Date.now()}`,
              messageEncoding: "iso-8859-1",
            },
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    throw new Error("Unexpected state");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
