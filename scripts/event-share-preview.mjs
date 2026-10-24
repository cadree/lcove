/**
 * Local proof for the event share function.
 * Serves the same routeEventShare path the Pages middleware uses,
 * then curls it with crawler user agents.
 */
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import jpeg from "jpeg-js";
import { routeEventShare, shareResultResponse } from "../functions/_shared/eventShare.js";
import { jpegSize, pngSize, renderFlyerDerivative } from "../functions/_shared/flyerImage.js";

const OUT = "/opt/cursor/artifacts/event-share";
const ID = "04040404-0404-4404-8404-040404040404";
const CARD = {
  id: ID,
  slug: "listening-night",
  title: "Listening night",
  host_name: "Ada Lane",
  start_date: "2026-11-01T23:00:00.000Z",
  timezone: "America/New_York",
  venue: "The loft",
  city: "New York",
  image_url: "https://cdn.example.com/ada-flyer.jpg",
};

function portraitJpeg() {
  const width = 240;
  const height = 420;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const band = Math.floor(y / 60);
      data[i] = band % 2 === 0 ? 255 : 36;
      data[i + 1] = 80 + Math.floor((x / width) * 80);
      data[i + 2] = 140 + (band % 3) * 30;
      data[i + 3] = 255;
    }
  }
  return jpeg.encode({ data, width, height }, 85).data;
}

const fixture = portraitJpeg();
const shell = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function cardFor(ref) {
  if (ref === "listening-night" || ref === ID) return { configured: true, card: CARD };
  if (ref === "secret-draft" || ref === "11111111-1111-4111-8111-111111111111") {
    return { configured: true, card: null };
  }
  return { configured: false, card: null };
}

const server = createServer(async (req, res) => {
  const request = new Request(`https://etherbylcove.com${req.url}`, { method: req.method, headers: req.headers });
  const result = await routeEventShare(request, {
    loadCard: async (ref) => cardFor(ref),
    loadHtml: async () => shell,
    renderImage: async (_card, kind) => renderFlyerDerivative(fixture, "image/jpeg", kind),
  });
  const response = shareResultResponse(result, req.method);
  if (!response) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "x-event-share": "passthrough" });
    res.end(req.method === "HEAD" ? undefined : shell);
    return;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const headers = {};
  response.headers.forEach((value, key) => { headers[key] = value; });
  res.writeHead(response.status, headers);
  res.end(req.method === "HEAD" ? undefined : bytes);
});

function curl(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("curl", args);
    const out = [];
    const err = [];
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("close", (code) => {
      if (code) reject(new Error(Buffer.concat(err).toString() || `curl ${code}`));
      else resolve(Buffer.concat(out));
    });
  });
}

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
mkdirSync(OUT, { recursive: true });

const agents = [
  ["twitterbot", "Twitterbot/1.0"],
  ["facebookexternalhit", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"],
  ["imessage", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) iMessageLinkPreviews"],
];

const tagReport = [];
for (const [name, ua] of agents) {
  const html = (await curl(["-sS", "-A", ua, `${base}/e/listening-night`])).toString("utf8");
  const tags = [...html.matchAll(/<title>[\s\S]*?<\/title>|<(?:meta|link)\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => /og:|twitter:|<title|rel="icon"|rel="apple-touch-icon"|name="description"|rel="canonical"|name="robots"/i.test(tag));
  tagReport.push(`## ${name}\n\n${tags.join("\n")}\n`);
  writeFileSync(`${OUT}/${name}.html`, html);
}

const hidden = (await curl(["-sS", "-A", "Twitterbot/1.0", "-D", "-", `${base}/e/secret-draft`])).toString("utf8");
const legacy = (await curl(["-sS", "-o", "/dev/null", "-D", "-", `${base}/event/${ID}`])).toString("utf8");
const landing = (await curl(["-sS", "-D", "-", "-o", "/dev/null", `${base}/`])).toString("utf8");
const flyerPath = `${OUT}/flyer.jpg`;
const iconPath = `${OUT}/icon.png`;
await curl(["-sS", "-o", flyerPath, `${base}/e/listening-night/flyer.jpg`]);
await curl(["-sS", "-o", iconPath, `${base}/e/listening-night/icon.png`]);
const flyer = readFileSync(flyerPath);
const icon = readFileSync(iconPath);
const sizes = {
  flyer: jpegSize(flyer),
  icon: pngSize(icon),
  flyerBytes: flyer.length,
  iconBytes: icon.length,
};
writeFileSync(`${OUT}/sizes.json`, `${JSON.stringify(sizes, null, 2)}\n`);
writeFileSync(
  `${OUT}/tags.md`,
  `${tagReport.join("\n")}\n## hidden draft\n\n\`\`\`\n${hidden}\n\`\`\`\n\n## legacy uuid\n\n\`\`\`\n${legacy}\n\`\`\`\n\n## landing passthrough header\n\n\`\`\`\n${landing}\n\`\`\`\n\n## image sizes\n\n\`\`\`json\n${JSON.stringify(sizes, null, 2)}\n\`\`\`\n`,
);
server.close();
console.log(JSON.stringify({ port, sizes, out: OUT }, null, 2));
