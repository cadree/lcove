import { supabase } from "@/integrations/supabase/client";
import { jpegStorageName } from "@/lib/heicImage";

/** Store a profile photo and return a URL that changes with every upload, so no screen keeps the old face cached. */
export async function uploadAvatar(userId: string, file: File, now = Date.now()): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = jpegStorageName(`${userId}/avatar.${ext}`, file.type);
  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return avatarVersion(data.publicUrl, now);
}

export function avatarVersion(url: string, now: number): string {
  const [base] = url.split("?");
  return `${base}?v=${now}`;
}
