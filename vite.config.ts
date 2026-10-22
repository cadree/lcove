import { spawnSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

function previewSupabaseGuard() {
  const result = spawnSync(
    process.execPath,
    [path.resolve(__dirname, "scripts/check-supabase-target.mjs")],
    { stdio: "inherit", env: process.env },
  );
  if (result.status !== 0) {
    throw new Error("Supabase preview target check failed");
  }
  return { name: "preview-supabase-guard" };
}

function isCharts(id: string): boolean {
  return id.includes("/recharts/") || id.includes("/d3-") || id.includes("/victory-vendor/");
}

function isEditors(id: string): boolean {
  return (
    id.includes("/html2canvas/") ||
    id.includes("/jspdf/") ||
    id.includes("/canvg/") ||
    id.includes("/dompurify/") ||
    id.includes("/fflate/") ||
    id.includes("/fast-png/") ||
    id.includes("/pako/")
  );
}

const entryReachable = new Map<string, boolean>();

function reachableFromEntry(
  id: string,
  getModuleInfo: (moduleId: string) => { isEntry: boolean; importers: readonly string[] } | null,
  stack = new Set<string>(),
): boolean {
  const cached = entryReachable.get(id);
  if (cached !== undefined) return cached;
  if (stack.has(id)) return false;
  const info = getModuleInfo(id);
  if (!info) return false;
  if (info.isEntry) {
    entryReachable.set(id, true);
    return true;
  }
  stack.add(id);
  let reached = false;
  for (const importer of info.importers) {
    if (reachableFromEntry(importer, getModuleInfo, stack)) {
      reached = true;
      break;
    }
  }
  stack.delete(id);
  entryReachable.set(id, reached);
  return reached;
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [previewSupabaseGuard(), react()],
  resolve: {
    alias: [
      // Exact match so a regenerated src/integrations/supabase/client.ts
      // cannot drop the Capacitor auth storage adapter. See docs/ios-release.md.
      {
        find: /^@\/integrations\/supabase\/client$/,
        replacement: path.resolve(__dirname, "./src/lib/supabaseClient.ts"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id, { getModuleInfo }) {
          if (isCharts(id)) return "charts";
          if (id.includes("/hls.js/")) return "video";
          if (isEditors(id)) return "editors";
          if (id.includes("/html5-qrcode/")) return "scanner";
          // The encoder loads only when a video is over the storage cap.
          if (id.includes("/mediabunny/")) return "video-compress";
          // Shared runtime stays in its own chunk. Rollup otherwise folds
          // React and the Vite preload helper into the first heavy chunk.
          if (reachableFromEntry(id, getModuleInfo) && (id.includes("node_modules") || id.startsWith("\0"))) {
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
}));
