/**
 * After a late image check, remove the member's rows that point at the
 * file. Posts, stories, and other rows that exist to show that file are
 * deleted. A picture field on a larger record is cleared. Storage deletion
 * is the caller's job. content_reports cannot store a system reporter, so
 * a row we cannot change is left with a missing file and a console error.
 */

type RowResult = { data: { id: string }[] | null; error: { message: string } | null };

type Filter = {
  select: (columns: string) => Promise<RowResult>;
  eq: (column: string, value: string) => Promise<RowResult>;
};

export type FlaggedImageDb = {
  from: (table: string) => {
    delete: () => { ilike: (column: string, pattern: string) => Filter };
    update: (values: Record<string, null | string[]>) => {
      ilike: (column: string, pattern: string) => Filter;
      eq: (column: string, value: string) => Promise<RowResult>;
    };
    select: (columns: string) => {
      contains: (column: string, value: string[]) => Promise<{
        data: Array<Record<string, unknown>> | null;
        error: { message: string } | null;
      }>;
    };
  };
};

type StringRef = { table: string; column: string; action: "delete" | "clear" };

const STRING_REFS: StringRef[] = [
  { table: "posts", column: "media_url", action: "delete" },
  { table: "stories", column: "media_url", action: "delete" },
  { table: "messages", column: "media_url", action: "delete" },
  { table: "contact_media", column: "media_url", action: "delete" },
  { table: "event_moodboard_items", column: "media_url", action: "delete" },
  { table: "event_flyers", column: "flyer_url", action: "delete" },
  { table: "portfolio_items", column: "media_url", action: "delete" },
  { table: "portfolio_items", column: "thumbnail_url", action: "delete" },
  { table: "project_attachments", column: "file_url", action: "delete" },
  { table: "profiles", column: "avatar_url", action: "clear" },
  { table: "blog_posts", column: "cover_image_url", action: "clear" },
  { table: "brand_partnerships", column: "brand_logo_url", action: "clear" },
  { table: "community_updates", column: "image_url", action: "clear" },
  { table: "content_submissions", column: "cover_art_url", action: "clear" },
  { table: "conversations", column: "avatar_url", action: "clear" },
  { table: "conversations", column: "cover_image_url", action: "clear" },
  { table: "dance_videos", column: "thumbnail_url", action: "clear" },
  { table: "dj_mixes", column: "cover_art_url", action: "clear" },
  { table: "event_email_branding", column: "header_image_url", action: "clear" },
  { table: "events", column: "image_url", action: "clear" },
  { table: "exclusive_tracks", column: "cover_image_url", action: "clear" },
  { table: "featured_creators", column: "cover_image_url", action: "clear" },
  { table: "live_streams", column: "thumbnail_url", action: "clear" },
  { table: "menu_items", column: "image_url", action: "clear" },
  { table: "music_profiles", column: "artist_image_url", action: "clear" },
  { table: "network_content", column: "cover_art_url", action: "clear" },
  { table: "networks", column: "banner_url", action: "clear" },
  { table: "networks", column: "logo_url", action: "clear" },
  { table: "organizations", column: "logo_url", action: "clear" },
  { table: "partners", column: "cover_image_url", action: "clear" },
  { table: "partners", column: "logo_url", action: "clear" },
  { table: "pipeline_items", column: "avatar_url", action: "clear" },
  { table: "portfolio_folders", column: "cover_image_url", action: "clear" },
  { table: "profile_customizations", column: "background_value", action: "clear" },
  { table: "profile_customizations", column: "profile_music_album_art_url", action: "clear" },
  { table: "projects", column: "cover_image_url", action: "clear" },
  { table: "stores", column: "cover_image_url", action: "clear" },
  { table: "stores", column: "logo_url", action: "clear" },
  { table: "tv_episodes", column: "thumbnail_url", action: "clear" },
  { table: "tv_seasons", column: "cover_art_url", action: "clear" },
];

const ARRAY_REFS = [{ table: "store_items", column: "images" }];

const RETRY_DELAYS_MS = [0, 700, 1_800, 4_000];

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sweepOnce(client: FlaggedImageDb, pattern: string, publicUrl: string, path: string): Promise<number> {
  let cleared = 0;
  for (const ref of STRING_REFS) {
    try {
      const filter =
        ref.action === "delete"
          ? client.from(ref.table).delete().ilike(ref.column, pattern)
          : client.from(ref.table).update({ [ref.column]: null }).ilike(ref.column, pattern);
      const { data, error } = await filter.select("id");
      if (error) {
        console.error(`Image takedown skipped ${ref.table}.${ref.column}`, error.message);
        continue;
      }
      cleared += data?.length ?? 0;
    } catch (error) {
      console.error(`Image takedown skipped ${ref.table}.${ref.column}`, error);
    }
  }

  for (const ref of ARRAY_REFS) {
    try {
      const { data, error } = await client.from(ref.table).select(`id, ${ref.column}`).contains(ref.column, [publicUrl]);
      if (error) {
        console.error(`Image takedown skipped ${ref.table}.${ref.column}`, error.message);
        continue;
      }
      for (const row of data ?? []) {
        const current = row[ref.column];
        const next = Array.isArray(current) ? current.filter((url) => typeof url === "string" && !url.includes(path)) : [];
        const updated = await client.from(ref.table).update({ [ref.column]: next }).eq("id", String(row.id));
        if (updated.error) {
          console.error(`Image takedown skipped ${ref.table}.${ref.column}`, updated.error.message);
          continue;
        }
        cleared += 1;
      }
    } catch (error) {
      console.error(`Image takedown skipped ${ref.table}.${ref.column}`, error);
    }
  }
  return cleared;
}

export async function retractFlaggedImage(
  client: FlaggedImageDb,
  publicUrl: string,
  path: string,
  delays: readonly number[] = RETRY_DELAYS_MS,
  followUpMs = 1_200,
): Promise<number> {
  const pattern = `%${escapeLike(path)}%`;
  let cleared = 0;
  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    const found = await sweepOnce(client, pattern, publicUrl, path);
    cleared += found;
    if (found > 0) {
      if (followUpMs > 0) {
        await sleep(followUpMs);
        cleared += await sweepOnce(client, pattern, publicUrl, path);
      }
      break;
    }
  }
  return cleared;
}
