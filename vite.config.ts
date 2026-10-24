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
  // Only the recharts entry. Forcing d3 into this chunk pulls a shared helper
  // into it, and the React runtime then imports the whole chart bundle.
  return id.includes("/node_modules/recharts/");
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

function isSharedRuntime(id: string): boolean {
  return (
    /\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|clsx|tailwind-merge)\//.test(id) ||
    id.includes("/node_modules/@remix-run/router/")
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
        // A lazy route's chart/editor chunk must not be hoisted onto the entry.
        hoistTransitiveImports: false,
        manualChunks(id, { getModuleInfo }) {
          // The CommonJS interop helper is shared with React. Leaving it in
          // the charts chunk makes every page download recharts.
          if (id.includes("commonjsHelpers")) return "vendor";
          if (isCharts(id)) return "charts";
          if (id.includes("/hls.js/")) return "video";
          if (isEditors(id)) return "editors";
          if (id.includes("/html5-qrcode/")) return "scanner";
          // The encoder loads only when a video is over the storage cap.
          if (id.includes("/mediabunny/")) return "video-compress";
          // LiveKit stays out of the Live list. The room sheet loads it.
          if (id.includes("/livekit-client/") || id.includes("/@livekit/")) return "livekit";
          if (id.includes("/framer-motion/") || id.includes("/motion-dom/") || id.includes("/motion-utils/")) {
            return "motion";
          }
          // React stays in its own chunk. Rollup otherwise folds React and
          // the Vite preload helper into the first heavy chunk. Other
          // libraries stay with the route that imports them.
          if (
            reachableFromEntry(id, getModuleInfo) &&
            (isSharedRuntime(id) || id.includes("vite/preload-helper"))
          ) {
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
}));
