/** How far outside the screen a feed video keeps its source. Beyond this it is unloaded. */
export const VIDEO_KEEP_MARGIN_PX = 800;

/**
 * Source to give a feed <video>. Off screen it gets none, so Safari can free
 * the decoder and buffered frames. "#t=0.001" makes iOS paint the first frame
 * as a poster without downloading the whole file.
 */
export function feedVideoSource(src: string | null | undefined, near: boolean): string | undefined {
  if (!src || !near) return undefined;
  if (src.startsWith("blob:") || src.includes("#")) return src;
  return `${src}#t=0.001`;
}
