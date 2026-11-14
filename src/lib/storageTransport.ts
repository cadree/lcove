import { StorageApiError } from "@supabase/storage-js";

/** Supabase's resumable endpoint takes exactly 6 MB chunks. */
export const RESUMABLE_CHUNK_BYTES = 6 * 1024 * 1024;

export interface SendObject {
  url: string;
  apiKey: string;
  token: string;
  bucketId: string;
  path: string;
  body: Blob;
  contentType: string;
  cacheControl: string;
  onProgress: (ratio: number) => void;
}

type SendResult = { data: { id: string; path: string; fullPath: string }; error: null } | { data: null; error: StorageApiError };

function stored(input: SendObject) {
  return { id: "", path: input.path, fullPath: `${input.bucketId}/${input.path}` };
}

export function objectUrl(url: string, bucketId: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${url.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(bucketId)}/${encoded}`;
}

/** Storage error bodies look like {statusCode: "409", error: "Duplicate", message: "..."}. */
export function storageError(status: number, text: string): StorageApiError {
  let message = text || `Upload failed (${status || "network"})`;
  let code = status;
  try {
    const parsed = JSON.parse(text) as { statusCode?: string | number; message?: string; error?: string };
    message = parsed.message || parsed.error || message;
    code = Number(parsed.statusCode) || status;
  } catch {
    // Plain-text or empty body.
  }
  if (!status && !text) message = "Network connection lost";
  return new StorageApiError(message, code, String(code));
}

export function sendStorageObject(input: SendObject): Promise<SendResult> {
  return input.body.size > RESUMABLE_CHUNK_BYTES ? sendResumable(input) : sendSimple(input);
}

function sendSimple(input: SendObject): Promise<SendResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", objectUrl(input.url, input.bucketId, input.path));
    xhr.setRequestHeader("authorization", `Bearer ${input.token}`);
    xhr.setRequestHeader("apikey", input.apiKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", `max-age=${input.cacheControl}`);
    xhr.setRequestHeader("content-type", input.contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total) input.onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        input.onProgress(1);
        resolve({ data: stored(input), error: null });
      } else {
        resolve({ data: null, error: storageError(xhr.status, xhr.responseText) });
      }
    };
    xhr.onerror = () => resolve({ data: null, error: storageError(0, "") });
    xhr.ontimeout = xhr.onerror;
    xhr.send(input.body);
  });
}

async function sendResumable(input: SendObject): Promise<SendResult> {
  const { Upload } = await import("tus-js-client");
  return new Promise((resolve) => {
    const upload = new Upload(input.body, {
      endpoint: `${input.url.replace(/\/$/, "")}/storage/v1/upload/resumable`,
      retryDelays: [0, 2000, 5000, 10000],
      headers: {
        authorization: `Bearer ${input.token}`,
        apikey: input.apiKey,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      // A retry in this session or after a reload picks up from the last chunk.
      removeFingerprintOnSuccess: true,
      chunkSize: RESUMABLE_CHUNK_BYTES,
      metadata: {
        bucketName: input.bucketId,
        objectName: input.path,
        contentType: input.contentType,
        cacheControl: input.cacheControl,
      },
      onProgress: (sent, total) => {
        if (total) input.onProgress(sent / total);
      },
      // The iOS app's bridged XHR has no byte events, so chunks keep the bar moving.
      onChunkComplete: (_chunk, accepted, total) => {
        if (total) input.onProgress(accepted / total);
      },
      onError: (error) => {
        const response = (error as { originalResponse?: { getStatus(): number; getBody(): string } | null }).originalResponse;
        resolve({ data: null, error: storageError(response?.getStatus() ?? 0, response?.getBody() ?? "") });
      },
      onSuccess: () => {
        input.onProgress(1);
        resolve({ data: stored(input), error: null });
      },
    });
    void upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }, () => upload.start());
  });
}
