import { createClient } from "@supabase/supabase-js";
import { StorageApiError } from "@supabase/storage-js";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { capacitorStorage } from "@/lib/capacitorStorage";
import { HeicConversionError, prepareStorageBody, StorageLimitError } from "@/lib/prepareStorageUpload";
import { withServerFunctionMessage } from "@/lib/functionError";
import { reviewImageUpload } from "@/lib/nsfwImageCheck";
import { EXPLICIT_REMOVED_MESSAGE, IMAGE_CHECK_WAIT_MS, settleReview } from "@/lib/nsfwGate";
import { retractFlaggedImage, type FlaggedImageDb } from "@/lib/nsfwRetract";
import { fileKind, isStorageSizeRejection, storageLimitMessage } from "@/lib/storageLimit";
import { supabaseProjectRef } from "@/lib/supabaseTarget.mjs";
import { sendStorageObject } from "@/lib/storageTransport";
import type { Database } from "@/integrations/supabase/types";

// Vite inlines VITE_* from the process environment and from a local .env file.
// Hosted builds must set these in the host's environment settings.
// Production (etherbylcove.com) keeps ether-prod. Cloudflare preview builds
// are refused if they embed that project. See docs/preview-staging.md.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseTarget = supabaseProjectRef(SUPABASE_URL, import.meta.env.VITE_SUPABASE_PROJECT_ID);

// Detect if running on native platform (iOS/Android)
const isNative = Capacitor.isNativePlatform();

// Log platform detection for debugging
console.log(
  "[Supabase Client] Platform:",
  Capacitor.getPlatform(),
  "isNative:",
  isNative,
  "project:",
  supabaseTarget.ref ?? "(unset)",
);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Use Capacitor Preferences on native, localStorage on web
    storage: isNative ? capacitorStorage : localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Disable URL session detection on native - auth comes through deep links
    detectSessionInUrl: !isNative,
    // Use PKCE flow for better mobile security
    flowType: "pkce",
  },
});

// Non-2xx function responses keep their JSON error string on error.message.
// Status 401 and 400 would otherwise surface as a generic Edge Function error.
const originalInvoke = supabase.functions.invoke.bind(supabase.functions);
supabase.functions.invoke = (async (functionName, options) => {
  const result = await originalInvoke(functionName, options);
  return withServerFunctionMessage(result);
}) as typeof supabase.functions.invoke;

// Every storage upload goes through this guard. Files at or under the 50 MB
// cap are sent unchanged. Larger videos are compressed in the browser first,
// with a progress toast. Larger images and other files are rejected with a
// plain message, and a size rejection from the server uses that same message.
// Image bytes are checked in parallel with the storage upload. The submit
// waits at most about a second for the model. A flagged object is removed.
// If the model is still loading, the upload and the post proceed, and the
// check finishes in the background. The check lives in nsfwImageCheck and
// loads only when the file is a picture. A newer upload of the same path
// wins the removal.
// The guard lives in this file, not the generated integrations client, so a
// Lovable regen of client.ts keeps it while the vite and tsconfig aliases
// still point here.
let compressToastSerial = 0;
const storagePathGeneration = new Map<string, number>();
let storagePathSerial = 0;

function claimStoragePath(bucketId: string, path: string) {
  const key = `${bucketId}/${path}`;
  const generation = ++storagePathSerial;
  storagePathGeneration.set(key, generation);
  return () => storagePathGeneration.get(key) === generation;
}

function limitError(message: string) {
  return new StorageApiError(message, 413, "413");
}

function blockedImageError(message: string) {
  return new StorageApiError(message, 422, "422");
}

function unsupportedImageError(message: string) {
  return new StorageApiError(message, 415, "415");
}

async function removePublishedImage(
  bucket: { remove: (paths: string[]) => Promise<{ error: { message?: string } | null }> },
  bucketId: string,
  path: string,
  ownsThisUpload: () => boolean,
) {
  if (!ownsThisUpload()) return;
  const removed = await bucket.remove([path]);
  if (removed.error) console.error("Upload remove failed after the image check", removed.error);
  if (!ownsThisUpload()) return;
  toast.error(EXPLICIT_REMOVED_MESSAGE);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ether-image-removed"));
  try {
    const { data } = supabase.storage.from(bucketId).getPublicUrl(path);
    await retractFlaggedImage(supabase as unknown as FlaggedImageDb, data.publicUrl, path);
  } catch (error) {
    console.error("Image takedown could not update content", error);
  }
}

type StorageBucket = ReturnType<typeof supabase.storage.from>;
type UploadArgs = Parameters<StorageBucket["upload"]>;
type UploadResult = Awaited<ReturnType<StorageBucket["upload"]>>;
type Send = (body: UploadArgs[1], options: UploadArgs[2]) => Promise<UploadResult>;

/** The guard above, with the network step passed in so background uploads can report progress. */
async function guardedUpload(
  bucket: StorageBucket,
  bucketId: string,
  path: string,
  fileBody: UploadArgs[1],
  fileOptions: UploadArgs[2],
  send: Send,
  onPrepareProgress?: (ratio: number) => void,
): Promise<UploadResult> {
  const blob = typeof Blob !== "undefined" && fileBody instanceof Blob ? fileBody : null;
  let body = fileBody;
  let options = fileOptions;

  if (blob) {
    const toastId = `ether-video-compress-${++compressToastSerial}`;
    let shown = false;
    let lastPercent = -1;
    let imageForReview = blob;
    try {
      const prepared = await prepareStorageBody(blob, (ratio) => {
        if (onPrepareProgress) {
          onPrepareProgress(ratio);
          return;
        }
        const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
        if (percent === lastPercent) return;
        lastPercent = percent;
        shown = true;
        toast.loading(`Compressing video... ${percent}%`, { id: toastId });
      });
      body = prepared.body;
      if (prepared.contentType === "image/jpeg" && prepared.body instanceof Blob) {
        imageForReview = prepared.body;
      }
      if (prepared.contentType) {
        options = { ...fileOptions, contentType: prepared.contentType };
      }
    } catch (error) {
      if (error instanceof HeicConversionError) {
        console.error("HEIC conversion failed", error);
        return { data: null, error: unsupportedImageError(error.message) };
      }
      const kind = fileKind(blob instanceof File ? blob.name : "", blob.type || "");
      const message = error instanceof StorageLimitError ? error.message : storageLimitMessage(kind);
      console.error("Upload blocked before storage", error);
      return { data: null, error: limitError(message) };
    } finally {
      if (shown) toast.dismiss(toastId);
    }

    const name = blob instanceof File ? blob.name : "";
    const ownsThisUpload = claimStoragePath(bucketId, path);
    const started = Date.now();
    const reviewPromise = reviewImageUpload(imageForReview, name).catch((error) => {
      console.error("Image check failed open", error);
      return { ok: true as const };
    });
    const result = await send(body, options);
    if (result.error && isStorageSizeRejection(result.error)) {
      const kind = fileKind(blob instanceof File ? blob.name : "", blob.type || "");
      return { data: null, error: limitError(storageLimitMessage(kind)) };
    }
    if (result.error) return result;
    const review = await settleReview(reviewPromise, IMAGE_CHECK_WAIT_MS - (Date.now() - started));
    if (review?.ok === false) {
      if (ownsThisUpload()) {
        const removed = await bucket.remove([path]);
        if (removed.error) console.error("Upload remove failed after the image check", removed.error);
      }
      console.error("Upload removed after the image check", review.message);
      return { data: null, error: blockedImageError(review.message) };
    }
    if (!review) {
      console.warn("Image check continuing after the upload");
      void reviewPromise.then((late) => {
        if (late.ok === false) void removePublishedImage(bucket, bucketId, path, ownsThisUpload);
      });
    }
    return result;
  }

  const result = await send(body, options);
  if (result.error && isStorageSizeRejection(result.error)) {
    return { data: null, error: limitError(storageLimitMessage("other")) };
  }
  return result;
}

const originalFrom = supabase.storage.from.bind(supabase.storage);
supabase.storage.from = ((bucketId: string) => {
  const bucket = originalFrom(bucketId);
  const originalUpload = bucket.upload.bind(bucket);
  bucket.upload = ((path, fileBody, fileOptions) =>
    guardedUpload(bucket, bucketId, path, fileBody, fileOptions, (body, options) => originalUpload(path, body, options))
  ) as typeof bucket.upload;
  return bucket;
}) as typeof supabase.storage.from;

/**
 * The same guarded upload with byte progress, for the background queue.
 * Compression (if any) fills the first 40% and the network the rest.
 * Returns the public URL. Big files go up in resumable 6 MB chunks.
 */
export async function uploadWithProgress(
  bucketId: string,
  path: string,
  file: Blob,
  onProgress: (ratio: number) => void,
): Promise<string> {
  const bucket = supabase.storage.from(bucketId);
  let compressed = false;
  const result = await guardedUpload(
    bucket,
    bucketId,
    path,
    file,
    { cacheControl: "3600", upsert: false },
    async (body, options) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return { data: null, error: new StorageApiError("Sign in again to finish this upload.", 401, "401") };
      return sendStorageObject({
        url: SUPABASE_URL,
        apiKey: SUPABASE_PUBLISHABLE_KEY,
        token,
        bucketId,
        path,
        body: body as Blob,
        contentType: options?.contentType || (body as Blob).type || "application/octet-stream",
        cacheControl: options?.cacheControl || "3600",
        onProgress: (ratio) => onProgress(compressed ? 0.4 + ratio * 0.6 : ratio),
      });
    },
    (ratio) => {
      compressed = true;
      onProgress(ratio * 0.4);
    },
  );
  if (result.error) {
    const status = Number((result.error as { status?: unknown }).status);
    // A retry after a lost response finds its own object already stored.
    if (status === 409 || /already exists|duplicate/i.test(result.error.message)) {
      return bucket.getPublicUrl(path).data.publicUrl;
    }
    throw result.error;
  }
  return bucket.getPublicUrl(path).data.publicUrl;
}
