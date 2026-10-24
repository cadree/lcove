import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Buffer } from "node:buffer";
import { eventDateLabel, eventTimeLabel } from "../_shared/event-time.mjs";
import { httpStatusForError } from "../_shared/http-error.mjs";
import { appleWalletConfigured, appleWalletEnv } from "../_shared/wallet-config.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ICON_PNG = "iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAYAAABWk2cPAAAALElEQVR4nO3NQQkAAAgEMPuXsI6tzhaCsMfeq/TkWkmlUqlUKpVKpVLpw3QBwCUnc56YhTIAAAAASUVORK5CYII=";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeSecret(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("BEGIN")) return Buffer.from(trimmed);
  return Buffer.from(trimmed, "base64");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const configured = appleWalletConfigured(appleWalletEnv());
    if (body.probe === true) return json({ configured });
    if (!configured) return json({ configured: false });

    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    const eventTitle = typeof body.eventTitle === "string" ? body.eventTitle : "";
    if (!eventId || !eventTitle) throw new Error("Missing eventId or eventTitle");

    const hostName = typeof body.hostName === "string" && body.hostName.trim() ? body.hostName.trim() : "Host";
    const venue = typeof body.venue === "string" ? body.venue : "";
    const guestName = typeof body.guestName === "string" ? body.guestName : "Guest";
    const qr = typeof body.qrCode === "string" && body.qrCode ? body.qrCode : `ether-event:${eventId}`;
    const dateLabel = eventDateLabel(body.eventDate, body.timezone);
    const timeLabel = body.eventDate ? eventTimeLabel(body.eventDate, body.timezone) : "";

    const { PKPass } = await import("npm:passkit-generator@3.4.0");
    const icon = Buffer.from(ICON_PNG, "base64");
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier: Deno.env.get("APPLE_PASS_TYPE_ID"),
      serialNumber: `${eventId}-${crypto.randomUUID()}`,
      teamIdentifier: Deno.env.get("APPLE_TEAM_ID"),
      organizationName: hostName,
      description: eventTitle,
      logoText: hostName,
      foregroundColor: "rgb(255, 248, 252)",
      backgroundColor: "rgb(24, 16, 22)",
      labelColor: "rgb(255, 159, 200)",
      eventTicket: {
        headerFields: [{ key: "when", label: "WHEN", value: dateLabel }],
        primaryFields: [{ key: "event", label: hostName, value: eventTitle }],
        secondaryFields: [
          { key: "venue", label: "VENUE", value: venue || "Venue" },
          { key: "guest", label: "GUEST", value: guestName },
        ],
        auxiliaryFields: timeLabel ? [{ key: "time", label: "TIME", value: timeLabel }] : [],
        backFields: [
          { key: "powered", label: "TICKET", value: "Powered by Ether" },
        ],
      },
    };

    const pass = new PKPass({
      "pass.json": Buffer.from(JSON.stringify(passJson)),
      "icon.png": icon,
      "logo.png": icon,
    }, {
      wwdr: decodeSecret(Deno.env.get("APPLE_WWDR_CERT") || ""),
      signerCert: decodeSecret(Deno.env.get("APPLE_PASS_CERT") || ""),
      signerKey: decodeSecret(Deno.env.get("APPLE_PASS_KEY") || ""),
      signerKeyPassphrase: Deno.env.get("APPLE_PASS_KEY_PASSPHRASE") || "",
    });
    pass.setBarcodes({ message: qr, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1" });
    const bytes = pass.getAsBuffer();

    return json({
      configured: true,
      platform: "apple",
      filename: `${eventTitle.replace(/[^\w.-]+/g, "-").slice(0, 40) || "ticket"}.pkpass`,
      pkpass: Buffer.from(bytes).toString("base64"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, httpStatusForError(error));
  }
});
