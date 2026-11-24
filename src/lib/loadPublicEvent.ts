import { supabase } from "@/integrations/supabase/client";
import { PUBLIC_EVENT_COLUMNS, publicRow } from "@/lib/consumerAccess";
import { isEventUuid } from "../../functions/_shared/eventShare.js";

export interface PublicEventRecord {
  id: string;
  slug?: string | null;
  creator_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  venue: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  image_url: string | null;
  ticket_type?: string | null;
  ticket_price?: number | null;
  credits_price?: number | null;
  timezone: string | null;
  flyer_font?: string | null;
  page_theme?: string | null;
  hide_address?: boolean | null;
  hide_host_notes?: boolean | null;
  absorb_fees?: boolean | null;
  password_protected?: boolean | null;
  is_public: boolean | null;
  status: string | null;
}

const EXTRA = "flyer_font, page_theme, hide_address, absorb_fees, password_protected";
const GUEST_COLUMNS = PUBLIC_EVENT_COLUMNS.filter((column) => column !== "address").join(", ");

function missingSlug(message: string | undefined) {
  if (!message) return false;
  return /slug/i.test(message) && /column|schema|does not exist|could not find/i.test(message);
}

export async function loadPublicEvent(ref: string): Promise<PublicEventRecord | null> {
  const id = isEventUuid(ref);
  const withSlug = `${GUEST_COLUMNS}, ${EXTRA}, hide_host_notes, slug`;
  const withoutNotes = `${GUEST_COLUMNS}, ${EXTRA}, slug`;
  const withoutSlug = `${GUEST_COLUMNS}, ${EXTRA}`;
  const run = (columns: string, key: "id" | "slug") =>
    supabase
      .from("events")
      .select(columns)
      .eq(key, ref)
      .or("status.is.null,status.neq.draft")
      .maybeSingle();

  let result = await run(withSlug, id ? "id" : "slug");
  if (result.error && /hide_host_notes/i.test(result.error.message || "")) {
    result = await run(withoutNotes, id ? "id" : "slug");
  }
  if (result.error && missingSlug(result.error.message) && id) {
    result = await run(withoutSlug, "id");
  }
  if (result.error) throw result.error;
  if (!result.data) return null;
  const row = publicRow<PublicEventRecord>(result.data);
  return { ...row, address: null };
}
