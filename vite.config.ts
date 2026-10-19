import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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

// Relative bundle URLs, one root base, and no crossorigin attribute.
// capacitor://localhost has no CORS headers for local files. A root base keeps
// the same relative URLs working when the website refreshes a nested route.
function capacitorBundleHtml() {
  return {
    name: "capacitor-bundle-html",
    enforce: "post" as const,
    transformIndexHtml: {
      order: "post" as const,
      handler(html: string) {
        const withoutBase = html.replace(/<base\b[^>]*>/gi, "");
        const withBase = withoutBase.replace(/<head([^>]*)>/i, '<head$1>\n    <base href="/" />');
        return withBase.replace(/<((?:script|link)\b[^>]*?) crossorigin(?:="[^"]*")?/gi, "<$1");
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // Dev stays at /. The production bundle uses relative asset URLs so they
  // resolve against <base href="/"> on capacitor://localhost and on the web.
  base: command === "build" ? "./" : "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), capacitorBundleHtml()],
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
