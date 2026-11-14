/**
 * Compress one real file that is over the 50 MB storage cap in headless Chrome.
 * Usage: node scripts/prove-video-compress.mjs
 */
import * as esbuild from "esbuild";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = "/tmp/ether-video-proof";
const samplePath = path.join(outDir, "sample.mp4");
const limit = 50 * 1024 * 1024;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code}`));
    });
  });
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await run("ffmpeg", [
  "-y",
  "-f", "lavfi",
  "-i", "testsrc2=size=1920x1080:rate=30",
  "-f", "lavfi",
  "-i", "sine=frequency=440:sample_rate=48000",
  "-t", "8",
  "-c:v", "libx264",
  "-preset", "veryfast",
  "-b:v", "70M",
  "-minrate", "70M",
  "-maxrate", "70M",
  "-bufsize", "4M",
  "-x264-params", "nal-hrd=cbr:filler=1",
  "-pix_fmt", "yuv420p",
  "-c:a", "aac",
  "-b:a", "128k",
  samplePath,
]);

const sampleStat = await stat(samplePath);
if (sampleStat.size <= limit) {
  throw new Error(`sample is ${sampleStat.size} bytes, need more than ${limit}`);
}

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["scripts/video-compress-proof-entry.ts"],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: outDir,
  platform: "browser",
  target: "es2022",
  plugins: [
    {
      name: "at-alias",
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => ({
          path: path.join(root, "src", `${args.path.slice(2)}.ts`),
        }));
      },
    },
  ],
});

const html = `<!doctype html>
<meta charset="utf-8">
<script type="module">
  import "./video-compress-proof-entry.js";
  try {
    const response = await fetch("/sample.mp4");
    const blob = await response.blob();
    const file = new File([blob], "sample.mp4", { type: "video/mp4" });
    const result = await window.runProof(file);
    await fetch("/result", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, ...result }),
    });
  } catch (error) {
    await fetch("/result", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: String(error && error.stack || error) }),
    });
  }
</script>
`;

let resolveResult = () => {};
const resultPromise = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timed out waiting for compression")), 180000);
  resolveResult = (value) => {
    clearTimeout(timer);
    resolve(value);
  };
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (req.method === "POST" && url.pathname === "/result") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    res.end("ok");
    resolveResult(value);
    return;
  }
  if (url.pathname === "/") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html);
    return;
  }
  if (url.pathname === "/sample.mp4") {
    res.setHeader("content-type", "video/mp4");
    res.end(await readFile(samplePath));
    return;
  }
  const filePath = path.join(outDir, decodeURIComponent(url.pathname));
  if (!filePath.startsWith(outDir)) {
    res.statusCode = 403;
    res.end("no");
    return;
  }
  try {
    const body = await readFile(filePath);
    res.setHeader("content-type", filePath.endsWith(".js") ? "text/javascript" : "application/octet-stream");
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("missing");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const pageUrl = `http://127.0.0.1:${port}/`;

const chrome = spawn("google-chrome", [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--autoplay-policy=no-user-gesture-required",
  pageUrl,
], { stdio: ["ignore", "inherit", "inherit"] });

let result;
try {
  result = await resultPromise;
} finally {
  chrome.kill("SIGKILL");
  server.close();
}

console.log(JSON.stringify({ sampleBytes: sampleStat.size, result }, null, 2));

if (!result.ok) {
  throw new Error(result.error || "compression failed");
}
if (result.before <= limit) throw new Error("input was not over the cap");
if (result.after > limit) throw new Error(`output ${result.after} still exceeds the cap`);
if (result.after >= result.before) throw new Error("output was not smaller");
if (result.width !== 1920 || result.height !== 1080) {
  throw new Error(`expected 1920x1080, got ${result.width}x${result.height}`);
}
if (result.contentType !== "video/mp4") throw new Error(`content type ${result.contentType}`);
if (result.maxProgress <= 0) throw new Error("progress never advanced");
if (!result.sameObjectWhenSmall) throw new Error("a small file was rewritten");

console.log("compression proof passed");
