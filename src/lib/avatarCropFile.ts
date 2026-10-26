import { AVATAR_JPEG_QUALITY, avatarOutputSide } from "@/lib/avatarCrop";

/**
 * Paint the framed square into a JPEG. The caller uploads that file through
 * the normal storage path, so the upload guard still runs.
 */
export async function cropToJpegFile(
  image: HTMLImageElement,
  crop: { x: number; y: number; size: number },
  fileName = "avatar.jpg",
): Promise<File> {
  if (!(crop.size > 0) || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error("Could not crop this photo");
  }
  const side = avatarOutputSide(crop.size);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not crop this photo");
  context.fillStyle = "#111111";
  context.fillRect(0, 0, side, side);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, side, side);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", AVATAR_JPEG_QUALITY);
  });
  if (!blob) throw new Error("Could not crop this photo");
  return new File([blob], fileName, { type: "image/jpeg" });
}
