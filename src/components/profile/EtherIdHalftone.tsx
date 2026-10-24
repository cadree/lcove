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
 * Hard dot screen. Light ground, black dots, high contrast.
 * A failed photo falls back to a monogram.
 */
export function EtherIdHalftone({
  src,
  name,
}: {
  src: string | null;
  name: string;
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
      const ground = "#e6e1d4";
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, width, height);

      const sample = document.createElement("canvas");
      sample.width = width;
      sample.height = height;
      const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
      if (!sampleCtx) return;
      sampleCtx.fillStyle = "#c8c2b4";
      sampleCtx.fillRect(0, 0, width, height);

      let drewPhoto = false;
      if (src) {
        try {
          const img = await loadHtmlImage(src);
          if (cancel) return;
          const scale = Math.max(width / img.width, height / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          sampleCtx.filter = "grayscale(1) contrast(1.35)";
          sampleCtx.drawImage(img, (width - dw) / 2, (height - dh) * 0.08, dw, dh);
          sampleCtx.filter = "none";
          drewPhoto = true;
        } catch {
          drewPhoto = false;
        }
      }
      if (!drewPhoto) {
        sampleCtx.fillStyle = "#1a1916";
        sampleCtx.font = `700 ${Math.round(width * 0.42)}px Orbitron, sans-serif`;
        sampleCtx.textAlign = "center";
        sampleCtx.textBaseline = "middle";
        sampleCtx.fillText((name || "E").trim().slice(0, 1).toUpperCase(), width / 2, height / 2);
      }

      const pixels = sampleCtx.getImageData(0, 0, width, height).data;
      const cell = Math.max(3, Math.round(2.7 * dpr));
      ctx.fillStyle = "#12110f";
      let row = 0;
      for (let y = 0; y < height; y += cell) {
        const shift = (row % 2) * (cell * 0.5);
        row += 1;
        for (let x = -cell; x < width; x += cell) {
          const sx = Math.min(width - 1, Math.max(0, Math.round(x + shift + cell / 2)));
          const sy = Math.min(height - 1, y + (cell >> 1));
          const i = (sy * width + sx) * 4;
          const alpha = pixels[i + 3];
          const raw = alpha < 24 ? 0.7 : (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255;
          const stretched = Math.min(1, Math.max(0, (raw - 0.08) / 0.78));
          const darkness = (1 - stretched) ** 0.72;
          const radius = Math.max(cell * 0.1, darkness * cell * 0.58);
          ctx.beginPath();
          ctx.arc(x + shift + cell / 2, y + cell / 2, radius, 0, Math.PI * 2);
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
  }, [name, src]);

  return <canvas ref={ref} className="ether-id-halftone" data-halftone="pending" aria-hidden="true" />;
}
