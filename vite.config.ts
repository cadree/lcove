import { spawnSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { eventShareConfigJson } from "./scripts/event-share-config.ts";

function eventShareConfigPlugin(): Plugin {
  return {
    name: "event-share-config",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "event-share-config.json",
        source: eventShareConfigJson(process.env),
      });
    },
  };
}

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

type ModuleInfo = {
  isEntry: boolean;
  importers: readonly string[];
};

type GetModuleInfo = (moduleId: string) => ModuleInfo | null;

const entryReachable = new Map<string, boolean>();

function reachableFromEntry(id: string, getModuleInfo: GetModuleInfo, stack = new Set<string>()): boolean {
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
  let incomplete = false;
  // Static importers only. A dynamic import() is a route boundary, so a
  // lazy page must not drag its libraries back onto the entry. A cycle must
  // not cache "unreachable": the other importer may be the entry.
  for (const importer of info.importers) {
    if (stack.has(importer)) {
      incomplete = true;
      continue;
    }
    if (reachableFromEntry(importer, getModuleInfo, stack)) {
      reached = true;
      break;
    }
  }
  stack.delete(id);
  if (reached || !incomplete) entryReachable.set(id, reached);
  return reached;
}

type BundleChunk = {
  type: string;
  fileName: string;
  modules?: Record<string, unknown>;
  imports?: string[];
  viteMetadata?: { importedCss?: Set<string> };
};

// The entry discovers a lazy route only after it has downloaded and run.
// Preloading that route (and the shared chunks it imports) from the HTML
// starts those files with the entry instead of in a second round trip.
// "/" matches only the landing path. Feed, profile, and /live stay behind the
// members prompt until a session exists, so their graphs are not preloaded
// for signed-out visitors. That queue was delaying the splash image.
function routePreloadPlugin() {
  const screens: { prefix: string; source: string }[] = [
    { prefix: "/", source: "/src/pages/Landing.tsx" },
    { prefix: "/auth", source: "/src/pages/Auth.tsx" },
    { prefix: "/feed", source: "/src/pages/Feed.tsx" },
    { prefix: "/profile", source: "/src/pages/Profile.tsx" },
    { prefix: "/live/", source: "/src/pages/PublicLivePage.tsx" },
    { prefix: "/live", source: "/src/pages/Live.tsx" },
    { prefix: "/event/", source: "/src/pages/PublicEventPage.tsx" },
  ];
  return {
    name: "route-preloads",
    transformIndexHtml: {
      order: "post" as const,
      handler(html: string, ctx: { bundle?: Record<string, BundleChunk> }) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const chunks = Object.values(bundle).filter((file) => file.type === "chunk");
        const chunkFor = (source: string) =>
          chunks.find((chunk) => Object.keys(chunk.modules || {}).some((id) => id.endsWith(source)));
        const walk = (fileName: string, files: Set<string>, styles: Set<string>) => {
          if (files.has(fileName)) return;
          const chunk = bundle[fileName];
          if (!chunk || chunk.type !== "chunk") return;
          files.add(fileName);
          for (const css of chunk.viteMetadata?.importedCss || []) styles.add(css);
          for (const imported of chunk.imports || []) walk(imported, files, styles);
        };
        const routes = screens.flatMap(({ prefix, source }) => {
          const chunk = chunkFor(source);
          if (!chunk) return [];
          const files = new Set<string>();
          const styles = new Set<string>();
          walk(chunk.fileName, files, styles);
          return [{
            p: prefix,
            f: [...files].map((file) => `/${file}`),
            s: [...styles].map((file) => `/${file}`),
          }];
        });
        if (routes.length === 0) return html;
        const script = `<script>(function(){var routes=${JSON.stringify(routes)};var path=location.pathname;var best=null;for(var i=0;i<routes.length;i++){var p=routes[i].p;var ok=p==="/"?path==="/":(p.charAt(p.length-1)==="/"?path.indexOf(p)===0:(path===p||path.indexOf(p+"/")===0));if(ok&&(!best||p.length>best.p.length))best=routes[i];}if(!best)return;var members=best.p==="/feed"||best.p==="/profile"||best.p==="/live";if(members){var signedIn=false;try{for(var n=0;n<localStorage.length;n++){var key=localStorage.key(n);if(key&&key.indexOf("-auth-token")!==-1&&localStorage.getItem(key)){signedIn=true;break;}}}catch(e){}if(!signedIn)return;}var head=document.head;var files=best.f||[];var styles=best.s||[];for(var j=0;j<files.length;j++){var l=document.createElement("link");l.rel="modulepreload";l.href=files[j];head.appendChild(l);}for(var k=0;k<styles.length;k++){var c=document.createElement("link");c.rel="preload";c.as="style";c.href=styles[k];head.appendChild(c);}})();</script>`;
        // Vite puts the deferred entry in the head, so its download has
        // started. Run this map after the splash image or it blocks that tag.
        const splash = html.match(/<div id="boot-splash"[\s\S]*?<\/div>/);
        if (splash) return html.replace(splash[0], `${splash[0]}${script}`);
        return html.replace("</body>", `${script}</body>`);
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [previewSupabaseGuard(), eventShareConfigPlugin(), react(), routePreloadPlugin()],
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
          // Image checks import these only on upload. One async chunk keeps
          // TensorFlow off the entry and out of the route preload list.
          if (
            id.includes("/node_modules/nsfwjs/") ||
            id.includes("/node_modules/@tensorflow/") ||
            id.includes("/node_modules/buffer/")
          ) {
            return "nsfw";
          }
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
          // Each icon was its own request. Guest pages were waiting on that queue.
          if (id.includes("/lucide-react/") && !reachableFromEntry(id, getModuleInfo)) return "icons";
          // React stays in its own chunk. Rollup otherwise folds React and
          // the Vite preload helper into the first heavy chunk. Shared
          // libraries stay with the route that imports them, one graph per
          // screen, instead of a second copy of every icon.
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
