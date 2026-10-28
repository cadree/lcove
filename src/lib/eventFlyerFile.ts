export interface FlyerPng {
  file: File;
  usedFlyerImage: boolean;
}

function fileName(title: string): string {
  const slug = title.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "event";
  return `${slug}_flyer.png`;
}

async function loadFlyer(url: string): Promise<ImageBitmap | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") && blob.size < 32) return null;
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not build the flyer image"));
    }, "image/png");
  });
}

/** A PNG of the flyer image. A title card is used only when the image cannot be fetched. */
export async function flyerPngFile(input: { title: string; imageUrl?: string | null }): Promise<FlyerPng> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not build the flyer image");

  const image = input.imageUrl ? await loadFlyer(input.imageUrl) : null;
  if (image) {
    canvas.width = image.width || 1080;
    canvas.height = image.height || 1350;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
  } else {
    canvas.width = 1080;
    canvas.height = 1350;
    context.fillStyle = "#1a1020";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f4efe8";
    context.font = "64px Georgia, serif";
    const words = input.title.trim() || "Event";
    const lines = words.length > 28 ? [words.slice(0, 28), words.slice(28, 56)] : [words];
    lines.forEach((line, index) => {
      context.fillText(line, 72, 640 + index * 84);
    });
  }

  const blob = await canvasBlob(canvas);
  return {
    file: new File([blob], fileName(input.title), { type: "image/png" }),
    usedFlyerImage: Boolean(image),
  };
}
