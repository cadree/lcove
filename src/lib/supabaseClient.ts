import { createClient } from "@supabase/supabase-js";
import { StorageApiError } from "@supabase/storage-js";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { capacitorStorage } from "@/lib/capacitorStorage";
import { prepareStorageBody, StorageLimitError } from "@/lib/prepareStorageUpload";
import { withServerFunctionMessage } from "@/lib/functionError";
import { reviewImageUpload } from "@/lib/nsfwImageCheck";
import { fileKind, isStorageSizeRejection, storageLimitMessage } from "@/lib/storageLimit";
import { supabaseProjectRef } from "@/lib/supabaseTarget.mjs";
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
// Image bytes are also checked before they are stored. The check lives in
// nsfwImageCheck and loads only when the file is a picture.
// The guard lives in this file, not the generated integrations client, so a
// Lovable regen of client.ts keeps it while the vite and tsconfig aliases
// still point here.
let compressToastSerial = 0;

function limitError(message: string) {
  return new StorageApiError(message, 413, "413");
}

function blockedImageError(message: string) {
  return new StorageApiError(message, 422, "422");
}

const originalFrom = supabase.storage.from.bind(supabase.storage);
supabase.storage.from = ((bucketId: string) => {
  const bucket = originalFrom(bucketId);
  const originalUpload = bucket.upload.bind(bucket);
  bucket.upload = (async (path, fileBody, fileOptions) => {
    const blob = typeof Blob !== "undefined" && fileBody instanceof Blob ? fileBody : null;
    let body = fileBody;
    let options = fileOptions;

    if (blob) {
      const toastId = `ether-video-compress-${++compressToastSerial}`;
      let shown = false;
      let lastPercent = -1;
      try {
        const prepared = await prepareStorageBody(blob, (ratio) => {
          const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));
          if (percent === lastPercent) return;
          lastPercent = percent;
          shown = true;
          toast.loading(`Compressing video... ${percent}%`, { id: toastId });
        });
        body = prepared.body;
        if (prepared.contentType) {
          options = { ...fileOptions, contentType: prepared.contentType };
        }
      } catch (error) {
        const kind = fileKind(blob instanceof File ? blob.name : "", blob.type || "");
        const message = error instanceof StorageLimitError ? error.message : storageLimitMessage(kind);
        console.error("Upload blocked before storage", error);
        return { data: null, error: limitError(message) };
      } finally {
        if (shown) toast.dismiss(toastId);
      }

      const name = blob instanceof File ? blob.name : "";
      try {
        const review = await reviewImageUpload(blob, name);
        if (review.ok === false) {
          console.error("Upload blocked before storage", review.message);
          return { data: null, error: blockedImageError(review.message) };
        }
      } catch (error) {
        console.error("Image check failed open", error);
      }
    }

    const result = await originalUpload(path, body, options);
    if (result.error && isStorageSizeRejection(result.error)) {
      const kind = blob ? fileKind(blob instanceof File ? blob.name : "", blob.type || "") : "other";
      return { data: null, error: limitError(storageLimitMessage(kind)) };
    }
    return result;
  }) as typeof bucket.upload;
  return bucket;
}) as typeof supabase.storage.from;
