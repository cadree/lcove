import { decideExplicit, shouldCheckImage } from "@/lib/nsfwGate";

/**
 * Lazy image check. TensorFlow, its wasm backend, and nsfwjs load after
 * sign-in (idle, or when an upload control mounts), not with the first
 * paint. Weights and wasm binaries stay in /nsfw as static files.
 *
 * The picture is drawn with its long side at 224 pixels before classify.
 * The model input is 224. A full-resolution photo is not the slow part.
 * The published MobileNetV2 weights are already small on disk. A larger
 * nsfwjs graph would be slower. The wasm backend runs that graph. WebGL
 * is used when this browser actually selects it.
 *
 * On iOS, CapacitorHttp leaves same-origin requests on the WebView, so
 * this file, the wasm binaries, and the code-split chunk load from the
 * app bundle. If the model cannot load or the picture cannot be decoded,
 * the upload proceeds.
 */
const MODEL_URL = "/nsfw/mobilenet_v2/model.json";
const MODEL_CACHE = "indexeddb://ether-nsfw-mobilenet-v2-1";
const WASM_PATH = "/nsfw/wasm/";
const MODEL_INPUT = 224;

type LoadedModel = {
  classify: (image: HTMLCanvasElement) => Promise<Array<{ className: string; probability: number }>>;
  model: { save: (url: string) => Promise<unknown> };
};

export type ImageReview = { ok: true } | { ok: false; message: string };

let loading: Promise<LoadedModel | null> | null = null;
let classifyChain: Promise<unknown> = Promise.resolve();

export async function reviewImageUpload(file: Blob, name = ""): Promise<ImageReview> {
  try {
    const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    if (!shouldCheckImage(name, file.type || "", header)) return { ok: true };

    const model = await loadModel();
    if (!model) return { ok: true };

    const canvas = await imageCanvas(file);
    if (!canvas) {
      console.error("Image check could not read the file; allowing the upload");
      return { ok: true };
    }

    const predictions = await enqueue(() => model.classify(canvas));
    const decision = decideExplicit(predictions);
    if (decision.action === "block") {
      console.warn(`Image upload blocked (${decision.label} ${decision.probability.toFixed(2)})`);
      return { ok: false, message: decision.message };
    }
    return { ok: true };
  } catch (error) {
    console.error("Image check failed open", error);
    return { ok: true };
  }
}

/**
 * Signed-in only, and only after the document load event, so landing and
 * the signed-out feed never request the model and the download is off the
 * first paint. A file input mounted later (a composer or upload control)
 * starts the same load without waiting out the idle timeout.
 * Returns a cleanup that cancels a start that has not run yet.
 */
export function watchImageCheckPrefetch(signedIn: boolean): () => void {
  if (!signedIn || typeof window === "undefined") return () => {};
  let stopped = false;
  let armed = false;
  let idle: number | undefined;
  let fallback: number | undefined;
  const start = () => {
    if (!stopped) void loadModel();
  };
  const arm = () => {
    if (stopped || armed) return;
    armed = true;
    const id = window.requestIdleCallback?.(start, { timeout: 3_000 });
    if (id !== undefined) idle = id;
    else fallback = window.setTimeout(start, 1_500);
  };
  const onLoad = () => arm();
  if (document.readyState === "complete") arm();
  else window.addEventListener("load", onLoad, { once: true });
  const observer = new MutationObserver((mutations) => {
    if (stopped || document.readyState !== "complete") return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('input[type="file"]') || node.querySelector('input[type="file"]')) {
          start();
          return;
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => {
    stopped = true;
    observer.disconnect();
    window.removeEventListener("load", onLoad);
    if (idle !== undefined) window.cancelIdleCallback?.(idle);
    if (fallback !== undefined) window.clearTimeout(fallback);
  };
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = classifyChain.then(job, job);
  classifyChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function loadModel(): Promise<LoadedModel | null> {
  if (!loading) {
    loading = createModel().catch((error) => {
      console.error("NSFW model failed to load; allowing the upload", error);
      loading = null;
      return null;
    });
  }
  return loading;
}

async function createModel(): Promise<LoadedModel> {
  const tf = await import("@tensorflow/tfjs");
  const wasm = await import("@tensorflow/tfjs-backend-wasm");
  const { load } = await import("nsfwjs/core");
  tf.enableProdMode();
  // The threaded wasm binary needs cross-origin isolation, which this app
  // does not set. Force the single-thread binary we ship.
  tf.env().set("WASM_HAS_MULTITHREAD_SUPPORT", false);
  wasm.setWasmPaths(WASM_PATH);
  wasm.setThreadsCount(1);
  await selectBackend(tf);
  try {
    return await load(MODEL_CACHE);
  } catch {
    // No cached copy yet, or this WebView has no IndexedDB.
  }

  const model = await load(MODEL_URL);
  void model.model.save(MODEL_CACHE).catch((error) => {
    console.error("NSFW model cache skipped", error);
  });
  return model;
}

async function selectBackend(tf: typeof import("@tensorflow/tfjs")): Promise<void> {
  try {
    const webgl = await tf.setBackend("webgl");
    if (webgl && tf.getBackend() === "webgl") return;
  } catch {
    // This browser has no GPU backend.
  }
  try {
    const wasm = await tf.setBackend("wasm");
    if (wasm && tf.getBackend() === "wasm") return;
  } catch (error) {
    console.error("Image check wasm backend failed", error);
  }
  await tf.setBackend("cpu");
  await tf.ready();
}

async function imageCanvas(file: Blob): Promise<HTMLCanvasElement | null> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      return drawImage(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  } catch {
    // HEIC and some phone pictures decode through an element when
    // createImageBitmap refuses the container.
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    const loaded = await new Promise<boolean>((resolve) => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    });
    if (!loaded) return null;
    return drawImage(image, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawImage(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement | null {
  if (!(width > 0) || !(height > 0)) return null;
  const scale = Math.min(1, MODEL_INPUT / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
