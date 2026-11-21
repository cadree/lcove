import { supabase } from "@/integrations/supabase/client";
import { isUuid } from "@/lib/likeNotice";

export interface OpenStory {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "photo" | "video";
  is_live: boolean;
  created_at: string;
  expires_at: string;
  credit_user_id?: string | null;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  credit_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

type StoryRow = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  is_live: boolean | null;
  created_at: string;
  expires_at: string;
  credit_user_id: string | null;
};

const STORY_COLUMNS = "id, user_id, media_url, media_type, is_live, created_at, expires_at, credit_user_id";

/**
 * Active stories for the owner, newest first, matching the feed.
 * Null means the story is gone or past expires_at, so the caller opens the profile.
 */
export async function loadLiveStories(storyId: string): Promise<OpenStory[] | null> {
  if (!isUuid(storyId)) return null;
  const now = new Date().toISOString();
  const { data: story, error } = await supabase
    .from("stories")
    .select(STORY_COLUMNS)
    .eq("id", storyId)
    .gt("expires_at", now)
    .maybeSingle();
  if (error) throw error;
  if (!story) return null;

  const { data: siblings, error: siblingsError } = await supabase
    .from("stories")
    .select(STORY_COLUMNS)
    .eq("user_id", story.user_id)
    .gt("expires_at", now)
    .order("created_at", { ascending: false });

  const rows = !siblingsError && siblings && siblings.length > 0 ? siblings : [story];
  if (!rows.some((row) => row.id === story.id)) rows.unshift(story);

  const userIds = [
    ...new Set(rows.flatMap((row) => (row.credit_user_id ? [row.user_id, row.credit_user_id] : [row.user_id]))),
  ];
  const { data: profiles } = await supabase
    .from("profiles_public")
    .select("user_id, display_name, avatar_url")
    .in("user_id", userIds);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

  return rows.map((row) => toOpenStory(row, profileMap));
}

function toOpenStory(
  row: StoryRow,
  profileMap: Map<string, { display_name: string | null; avatar_url: string | null }>,
): OpenStory {
  return {
    id: row.id,
    user_id: row.user_id,
    media_url: row.media_url,
    media_type: row.media_type === "video" ? "video" : "photo",
    is_live: Boolean(row.is_live),
    created_at: row.created_at,
    expires_at: row.expires_at,
    credit_user_id: row.credit_user_id,
    profile: profileMap.get(row.user_id) ?? { display_name: null, avatar_url: null },
    credit_profile: row.credit_user_id ? profileMap.get(row.credit_user_id) ?? null : null,
  };
}
