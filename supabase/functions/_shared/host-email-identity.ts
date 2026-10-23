// Shared helper: resolves the personalized "From" identity for host event emails.
// Always sends through the verified platform domain — never spoofs host mailboxes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  HOST_EVENT_FROM_ADDRESS,
  PLATFORM_FALLBACK_REPLY_TO,
  hostFromHeader,
  sanitizeDisplayName,
} from "./host-email-address.mjs";

export { HOST_EVENT_FROM_ADDRESS, PLATFORM_FALLBACK_REPLY_TO };

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

interface EventIdentityRow {
  creator_id?: string | null;
  image_url?: string | null;
}

interface BrandingIdentityRow {
  from_name_override?: string | null;
  reply_to_email?: string | null;
  reply_to_verified_at?: string | null;
  organizer_name?: string | null;
  header_image_url?: string | null;
  brand_color?: string | null;
  signature?: string | null;
  personal_note?: string | null;
}

interface ProfileIdentityRow {
  display_name?: string | null;
  avatar_url?: string | null;
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

  const event = eventRes.data as unknown as EventIdentityRow | null;
  const branding = brandingRes.data as unknown as BrandingIdentityRow | null;

  let hostDisplayName = "The Host";
  let hostAvatarUrl: string | null = null;
  if (event?.creator_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", event.creator_id)
      .single();
    const profileIdentity = profile as unknown as ProfileIdentityRow | null;
    if (profileIdentity) {
      hostDisplayName = profileIdentity.display_name || hostDisplayName;
      hostAvatarUrl = profileIdentity.avatar_url || null;
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
    fromHeader: hostFromHeader(fromName),
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
