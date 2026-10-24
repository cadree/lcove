import { useEffect, useRef } from "react";

function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

/**
 * Dot-screen portrait. Static. A failed photo falls back to a monogram.
 */
export function EtherIdHalftone({
  src,
  name,
  banned,
}: {
  src: string | null;
  name: string;
  banned: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancel = false;

    const draw = async () => {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW < 2 || cssH < 2) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(cssW * dpr);
      const height = Math.round(cssH * dpr);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const ground = banned ? "#1a0608" : "#08080a";
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, width, height);

      const sample = document.createElement("canvas");
      sample.width = width;
      sample.height = height;
      const sampleCtx = sample.getContext("2d");
      if (!sampleCtx) return;
      sampleCtx.fillStyle = ground;
      sampleCtx.fillRect(0, 0, width, height);

      let drewPhoto = false;
      if (src) {
        try {
          const img = await loadHtmlImage(src);
          if (cancel) return;
          const scale = Math.max(width / img.width, height / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          sampleCtx.drawImage(img, (width - dw) / 2, (height - dh) * 0.16, dw, dh);
          drewPhoto = true;
        } catch {
          drewPhoto = false;
        }
      }
      if (!drewPhoto) {
        sampleCtx.fillStyle = "#ece7dc";
        sampleCtx.font = `800 ${Math.round(width * 0.42)}px Archivo, sans-serif`;
        sampleCtx.textAlign = "center";
        sampleCtx.textBaseline = "middle";
        sampleCtx.fillText((name || "E").trim().slice(0, 1).toUpperCase(), width / 2, height / 2);
      }

      const pixels = sampleCtx.getImageData(0, 0, width, height).data;
      const cell = Math.max(3, Math.round(3.2 * dpr));
      for (let y = 0; y < height; y += cell) {
        for (let x = 0; x < width; x += cell) {
          const sx = Math.min(width - 1, x + (cell >> 1));
          const sy = Math.min(height - 1, y + (cell >> 1));
          const i = (sy * width + sx) * 4;
          const alpha = pixels[i + 3];
          const raw = alpha < 24 ? 0 : (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255;
          const light = raw ** 0.62;
          const radius = light * cell * 0.5;
          if (radius < 0.6) continue;
          let color = "#ece7dc";
          if (banned && light < 0.45) color = "#ff3d49";
          else if (light > 0.78) color = "#79c3cf";
          else if (light < 0.42) color = "#ff9fc8";
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x + cell / 2, y + cell / 2, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (!cancel) canvas.dataset.halftone = "ready";
    };

    const observer = new ResizeObserver(() => {
      void draw();
    });
    observer.observe(canvas);
    void draw();
    return () => {
      cancel = true;
      observer.disconnect();
    };
  }, [banned, name, src]);

  return <canvas ref={ref} className="ether-id-halftone" data-halftone="pending" aria-hidden="true" />;
}
