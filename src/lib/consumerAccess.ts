// Columns the anon role may read. Keep these lists equal to the GRANT
// statements in supabase/migrations/20261024120000_anon_consumer_access.sql.

import type { Database } from "@/integrations/supabase/types";

type PublicTable = Database["public"]["Tables"];

export const PUBLIC_EVENT_COLUMNS = [
  "id",
  "creator_id",
  "title",
  "description",
  "start_date",
  "end_date",
  "venue",
  "address",
  "city",
  "state",
  "country",
  "image_url",
  "ticket_price",
  "ticket_type",
  "capacity",
  "timezone",
  "external_url",
  "event_type",
  "credits_price",
  "waitlist_enabled",
  "is_public",
  "status",
] as const;

export const PUBLIC_TICKET_TIER_COLUMNS = [
  "id",
  "event_id",
  "name",
  "description",
  "price_cents",
  "currency",
  "credits_price",
  "is_active",
  "sort_order",
] as const;

export const PUBLIC_STORE_COLUMNS = [
  "id",
  "user_id",
  "name",
  "description",
  "cover_image_url",
  "logo_url",
  "is_active",
  "accepts_cash",
  "accepts_credits",
  "flat_shipping_cents",
  "tax_line_label",
  "tax_line_cents",
] as const;

export const PUBLIC_STORE_ITEM_COLUMNS = [
  "id",
  "store_id",
  "category_id",
  "type",
  "title",
  "description",
  "price",
  "credits_price",
  "currency",
  "images",
  "is_active",
  "inventory_count",
  "duration_minutes",
  "location",
  "amenities",
  "external_url",
] as const;

export const PUBLIC_EVENT_SELECT = PUBLIC_EVENT_COLUMNS.join(", ");
export const PUBLIC_TICKET_TIER_SELECT = PUBLIC_TICKET_TIER_COLUMNS.join(", ");
export const PUBLIC_STORE_SELECT = PUBLIC_STORE_COLUMNS.join(", ");
export const PUBLIC_STORE_ITEM_SELECT = PUBLIC_STORE_ITEM_COLUMNS.join(", ");

export type PublicEvent = Pick<PublicTable["events"]["Row"], (typeof PUBLIC_EVENT_COLUMNS)[number]>;
export type PublicTicketTier = Pick<PublicTable["ticket_tiers"]["Row"], (typeof PUBLIC_TICKET_TIER_COLUMNS)[number]>;
export type PublicStore = Pick<PublicTable["stores"]["Row"], (typeof PUBLIC_STORE_COLUMNS)[number]>;
export type PublicStoreItem = Pick<PublicTable["store_items"]["Row"], (typeof PUBLIC_STORE_ITEM_COLUMNS)[number]>;

/** PostgREST cannot parse a joined column list, so the caller names the row. */
export function publicRow<T>(value: unknown): T {
  return value as T;
}

const CONSUMER_PREFIXES = ["/event/", "/product/", "/live/"];

export function isConsumerPath(pathname: string): boolean {
  return CONSUMER_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
