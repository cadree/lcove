#!/usr/bin/env node
// One-off, run by hand AFTER 20261114220000_locked_music.sql is applied.
// Moves every exclusive track whose full file is still public (audio_file_url in
// the public `media` bucket) into the private `music-private` bucket:
//   1. download the public file
//   2. upload it to music-private/<artist>/<same file name>
//   3. make a 15-second public preview (needs ffmpeg on PATH; skipped if missing)
//   4. set audio_file_path (+ preview_clip_url), clear audio_file_url
//   5. delete the public copy
// Dry run by default. Pass --apply to write.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/move-legacy-locked-tracks.mjs [--apply]
//
// The service-role key is read from the environment and never printed.
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const apply = process.argv.includes("--apply");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const PUBLIC_PREFIX = `${url.replace(/\/$/, "")}/storage/v1/object/public/media/`;

let hasFfmpeg = true;
try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { hasFfmpeg = false; }

const { data: tracks, error } = await supabase
  .from("exclusive_tracks")
  .select("id, artist_user_id, title, audio_file_url, audio_file_path, preview_clip_url, preview_start_seconds, preview_duration_seconds")
  .not("audio_file_url", "is", null)
  .is("audio_file_path", null);
if (error) throw error;

console.log(`${tracks.length} track(s) with a public full file. ${apply ? "APPLYING" : "dry run"}; ffmpeg ${hasFfmpeg ? "found" : "missing (no previews)"}.`);
const dir = mkdtempSync(join(tmpdir(), "locked-music-"));

for (const t of tracks) {
  if (!t.audio_file_url.startsWith(PUBLIC_PREFIX)) {
    console.log(`- ${t.id} "${t.title}": not in this project's media bucket, skipped`);
    continue;
  }
  const mediaPath = decodeURIComponent(t.audio_file_url.slice(PUBLIC_PREFIX.length));
  const fileName = mediaPath.split("/").pop();
  const privatePath = `${t.artist_user_id}/${fileName}`;
  console.log(`- ${t.id} "${t.title}": media/${mediaPath} -> music-private/${privatePath}`);
  if (!apply) continue;

  const { data: blob, error: dlErr } = await supabase.storage.from("media").download(mediaPath);
  if (dlErr) throw dlErr;
  const bytes = Buffer.from(await blob.arrayBuffer());
  const { error: upErr } = await supabase.storage.from("music-private").upload(privatePath, bytes, { contentType: blob.type || "audio/mpeg", upsert: true });
  if (upErr) throw upErr;

  let previewUrl = t.preview_clip_url;
  if (!previewUrl && hasFfmpeg) {
    const src = join(dir, fileName);
    const out = join(dir, `${t.id}-preview.mp3`);
    writeFileSync(src, bytes);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(t.preview_start_seconds || 0), "-t", String(t.preview_duration_seconds || 15), "-i", src, "-ac", "1", "-b:a", "96k", "-af", "afade=t=in:d=0.25", out]);
    const previewPath = `${t.artist_user_id}/exclusive-preview-${t.id}.mp3`;
    const { error: pErr } = await supabase.storage.from("media").upload(previewPath, readFileSync(out), { contentType: "audio/mpeg", upsert: true });
    if (pErr) throw pErr;
    previewUrl = supabase.storage.from("media").getPublicUrl(previewPath).data.publicUrl;
  }

  const { error: rowErr } = await supabase
    .from("exclusive_tracks")
    .update({ audio_file_path: privatePath, audio_file_url: null, preview_clip_url: previewUrl })
    .eq("id", t.id);
  if (rowErr) throw rowErr;
  const { error: rmErr } = await supabase.storage.from("media").remove([mediaPath]);
  if (rmErr) throw rmErr;
  console.log(`  moved${previewUrl ? " + preview" : " (no preview)"}`);
}
