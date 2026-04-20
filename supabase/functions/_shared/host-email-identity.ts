// Shared helper: resolves the personalized "From" identity for host event emails.
// Always sends through the verified platform domain — never spoofs host mailboxes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export const HOST_EVENT_FROM_ADDRESS = "events@notify.etherbylcove.com";
export const PLATFORM_FALLBACK_REPLY_TO = "support@notify.etherbylcove.com";

export interface HostIdentity {
  fromName: string;
  fromHeader: string; // RFC 5322 ready: "Name via Ether" <events@...>
  fromAddress: string;
  replyTo: string;
  replyToVerified: boolean;
  organizerName: string;
  hostDisplayName: string;
  hostAvatarUrl: string | null;
  headerImageUrl: string | null;
  brandColor: string;
  signature: string | null;
  personalNote: string | null;
}

// Strip CR/LF and quotes — prevents header injection in display name.
function sanitizeDisplayName(name: string): string {
  return (name || "")
    .replace(/[\r\n"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function resolveHostIdentity(
  supabaseAdmin: ReturnType<typeof createClient>,
  eventId: string
): Promise<HostIdentity> {
  // Pull event + creator profile + branding row in parallel
  const [eventRes, brandingRes] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("id, title, creator_id, image_url")
      .eq("id", eventId)
      .single(),
    supabaseAdmin
      .from("event_email_branding")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle(),
  ]);

  const event: any = eventRes.data;
  const branding: any = brandingRes.data;

  let hostDisplayName = "The Host";
  let hostAvatarUrl: string | null = null;
  if (event?.creator_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", event.creator_id)
      .single();
    if (profile) {
      hostDisplayName = (profile as any).display_name || hostDisplayName;
      hostAvatarUrl = (profile as any).avatar_url || null;
    }
  }

  const fromNameRaw =
    branding?.from_name_override ||
    `${hostDisplayName} via Ether`;
  const fromName = sanitizeDisplayName(fromNameRaw);

  const replyToVerified = Boolean(
    branding?.reply_to_email && branding?.reply_to_verified_at
  );
  const replyTo = replyToVerified
    ? branding.reply_to_email
    : PLATFORM_FALLBACK_REPLY_TO;

  return {
    fromName,
    fromHeader: `${fromName} <${HOST_EVENT_FROM_ADDRESS}>`,
    fromAddress: HOST_EVENT_FROM_ADDRESS,
    replyTo,
    replyToVerified,
    organizerName: branding?.organizer_name || hostDisplayName,
    hostDisplayName,
    hostAvatarUrl,
    headerImageUrl: branding?.header_image_url || event?.image_url || null,
    brandColor: branding?.brand_color || "#e91e8c",
    signature: branding?.signature || null,
    personalNote: branding?.personal_note || null,
  };
}
