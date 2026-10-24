import { decideExplicit, shouldCheckImage } from "@/lib/nsfwGate";

/**
 * Lazy image check. TensorFlow and nsfwjs load on the first image upload,
 * not with the app. Weights stay in /nsfw as static files, outside the
 * JavaScript bundle. On iOS, CapacitorHttp leaves same-origin requests on
 * the WebView, so this file and the code-split chunk load from the app
 * bundle. If the model cannot load or the picture cannot be decoded, the
 * upload proceeds.
 */
const MODEL_URL = "/nsfw/mobilenet_v2/model.json";
const MODEL_CACHE = "indexeddb://ether-nsfw-mobilenet-v2-1";
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
  const { load } = await import("nsfwjs/core");
  tf.enableProdMode();
  await tf.ready();

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
