import type { EmbedDraft, StoredEmbedFields } from "@/lib/videoEmbed";

export interface ProfilePost extends StoredEmbedFields {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  location: string | null;
  collaborators: string[] | null;
  alt_text: string | null;
  comments_enabled: boolean | null;
  folder_id: string | null;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  grid_key?: string;
  repost?: {
    id: string;
    user_id: string;
    created_at: string;
    profile?: {
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
}

export interface ComposePostInput {
  content?: string;
  file?: File;
  files?: File[];
  mediaType?: "photo" | "video" | "text" | "collage";
  location?: string;
  altText?: string;
  commentsEnabled?: boolean;
  embed?: EmbedDraft;
}
