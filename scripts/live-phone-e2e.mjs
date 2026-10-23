/**
 * Two-browser proof of the live room at an iPhone size.
 *
 * Chromium and WebKit each open a host page and a viewer page against the
 * local preview, with fake cameras. LiveKit runs on this machine. Supabase is
 * not contacted: the script answers the same HTTP calls the app makes.
 *
 *   LIVE_E2E_URL=http://127.0.0.1:4173 node scripts/live-phone-e2e.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { liveKitVideoGrant, signLiveKitToken } from "../supabase/functions/_shared/livekit-access.mjs";

const require = createRequire("/tmp/e2e-node/package.json");
const { chromium, webkit } = require("playwright");

const APP = process.env.LIVE_E2E_URL || "http://127.0.0.1:4173";
const API = "http://127.0.0.1:5499";
const LIVEKIT_URL = process.env.LIVEKIT_URL || "ws://127.0.0.1:7880";
const LIVEKIT_KEY = "devkey";
const LIVEKIT_SECRET = "this-is-a-long-enough-livekit-secret";
const HOST_ID = "00000000-0000-4000-8000-0000000000aa";
const VIEWER_ID = "00000000-0000-4000-8000-0000000000b1";
const STREAM_ID = "0412aaaa-0000-4000-8000-000000000041";
const CHILD_ID = "0412aaaa-0000-4000-8000-000000000042";
const OUT = process.env.LIVE_E2E_OUT || "/tmp/live-e2e";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function profile(id, name) {
  return {
    id,
    user_id: id,
    display_name: name,
    avatar_url: null,
    bio: null,
    city: null,
    city_display: null,
    city_key: null,
    onboarding_completed: true,
    access_status: "active",
    access_level: "member",
    mindset_level: 1,
    founding: false,
    passion_seriousness: null,
    social_links: null,
    is_suspended: false,
    passed_exam: true,
    show_only_to_passed_exam: false,
    phone: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
  };
}

function freshState() {
  return {
    stream: {
      id: STREAM_ID,
      host_id: HOST_ID,
      title: "Late night vibes",
      description: "Hello, Cadre wallace",
      stream_type: "webrtc",
      external_url: null,
      thumbnail_url: null,
      thumbnail_focal_point: { x: 50, y: 50 },
      is_live: false,
      started_at: null,
      ended_at: null,
      viewer_count: 0,
      total_tips: 0,
      created_at: "2026-10-23T00:00:00.000Z",
      replay_available: false,
      replay_url: null,
      rtmp_stream_key: null,
      rtmp_ingest_url: null,
      playback_url: null,
      mux_live_stream_id: null,
      mux_playback_id: null,
      event_type: null,
      is_virtual_event: false,
      max_attendees: null,
      parent_event_id: null,
      requires_ticket: false,
      ticket_price: null,
    },
    // A later event points at the ended stream. A plain DELETE is blocked
    // until parent_event_id is cleared (ON DELETE SET NULL / the owner RPC).
    child: {
      id: CHILD_ID,
      host_id: HOST_ID,
      title: "Afterparty",
      description: "Follows late night",
      stream_type: "webrtc",
      external_url: null,
      thumbnail_url: null,
      thumbnail_focal_point: { x: 50, y: 50 },
      is_live: false,
      started_at: "2026-10-22T00:00:00.000Z",
      ended_at: "2026-10-22T01:00:00.000Z",
      viewer_count: 0,
      total_tips: 0,
      created_at: "2026-10-22T00:00:00.000Z",
      replay_available: false,
      replay_url: null,
      rtmp_stream_key: null,
      rtmp_ingest_url: null,
      playback_url: null,
      mux_live_stream_id: null,
      mux_playback_id: null,
      event_type: null,
      is_virtual_event: false,
      max_attendees: null,
      parent_event_id: STREAM_ID,
      requires_ticket: false,
      ticket_price: null,
    },
    deleted: false,
    directDeleteBlocked: false,
    chat: [],
    reactions: [],
    tips: [],
    gifts: [],
    files: new Map(),
  };
}

function fileFromUpload(bytes, contentType) {
  if (!String(contentType).includes("multipart/form-data")) {
    return { bytes, type: String(contentType).split(";")[0] || "video/webm" };
  }
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  if (!boundaryMatch) return { bytes, type: "video/webm" };
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  let cursor = 0;
  while (cursor < bytes.length) {
    const start = bytes.indexOf(boundary, cursor);
    if (start < 0) break;
    const after = start + boundary.length;
    if (bytes[after] === 45 && bytes[after + 1] === 45) break;
    let partStart = after;
    if (bytes[partStart] === 13 && bytes[partStart + 1] === 10) partStart += 2;
    const next = bytes.indexOf(boundary, partStart);
    const partEnd = next < 0 ? bytes.length : next;
    let part = bytes.subarray(partStart, partEnd);
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, part.length - 2);
    }
    const sep = part.indexOf("\r\n\r\n");
    if (sep >= 0) {
      const header = part.subarray(0, sep).toString("utf8");
      if (/filename=/i.test(header) || /content-type:\s*video\//i.test(header)) {
        const typeMatch = /content-type:\s*([^\r\n;]+)/i.exec(header);
        return {
          bytes: Buffer.from(part.subarray(sep + 4)),
          type: typeMatch ? typeMatch[1].trim() : "video/webm",
        };
      }
    }
    cursor = next < 0 ? bytes.length : next;
  }
  return { bytes, type: "video/webm" };
}

function sessionFor(userId, name, email) {
  return {
    access_token: `token-${userId}`,
    refresh_token: `refresh-${userId}`,
    expires_in: 60 * 60 * 24 * 30,
    expires_at: 2_000_000_000,
    token_type: "bearer",
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email,
      app_metadata: { provider: "email" },
      user_metadata: { display_name: name },
      created_at: "2026-10-01T00:00:00.000Z",
    },
  };
}

function userIdFrom(request) {
  const header = request.headers()["authorization"] || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (token.startsWith("token-")) return token.slice("token-".length);
  return null;
}

function wantsObject(request) {
  return (request.headers()["accept"] || "").includes("vnd.pgrst.object");
}

function rowsFor(state, table, request) {
  const url = new URL(request.url());
  const id = url.searchParams.get("id")?.replace(/^eq\./, "");
  const userId = url.searchParams.get("user_id")?.replace(/^eq\./, "");
  const streamId = url.searchParams.get("stream_id")?.replace(/^eq\./, "");
  const matchStream = (row) => !streamId || row.stream_id === streamId || row.id === streamId;
  if (table === "live_streams" || table === "live_streams_public") {
    const rows = [];
    if (!state.deleted) rows.push(state.stream);
    if (state.child) rows.push(state.child);
    const liveOnly = url.searchParams.get("is_live");
    const filtered = liveOnly === "eq.true" ? rows.filter((row) => row.is_live === true) : rows;
    if (!id) return filtered;
    return filtered.filter((row) => row.id === id);
  }
  if (table === "profiles" || table === "profiles_public") {
    const people = [profile(HOST_ID, "Cadre Wallace"), profile(VIEWER_ID, "Nico Lane")];
    return people.filter((person) => !userId || person.user_id === userId);
  }
  if (table === "stream_chat") return state.chat.filter(matchStream);
  if (table === "stream_reactions") return state.reactions.filter(matchStream);
  if (table === "stream_tips") return state.tips.filter(matchStream);
  if (table === "stream_gifts") return state.gifts.filter(matchStream);
  if (table === "stream_viewers") return [];
  return [];
}

async function handleApi(route, state, log) {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() === "OPTIONS") {
    await route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "*",
      },
    });
    return;
  }

  const json = (body, status = 200, headers = {}) => route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "*",
      ...headers,
    },
    body: body === undefined ? "" : JSON.stringify(body),
  });

  log(`${request.method()} ${url.pathname}`);

  if (url.pathname === "/auth/v1/user" || url.pathname.startsWith("/auth/v1/token")) {
    const id = userIdFrom(request) || HOST_ID;
    const name = id === VIEWER_ID ? "Nico Lane" : "Cadre Wallace";
    const email = id === VIEWER_ID ? "nico@ether.test" : "cadre@ether.test";
    const session = sessionFor(id, name, email);
    await json(url.pathname.endsWith("/user") ? session.user : session);
    return;
  }

  if (url.pathname === "/functions/v1/livekit-token") {
    const body = request.postDataJSON?.() || {};
    const id = userIdFrom(request);
    const streamId = typeof body.streamId === "string" ? body.streamId : "";
    if (!id || streamId !== state.stream.id || state.deleted) {
      await json({ error: "Stream not found" }, 404);
      return;
    }
    const video = liveKitVideoGrant(id, state.stream.host_id, streamId);
    const signed = await signLiveKitToken({
      apiKey: LIVEKIT_KEY,
      apiSecret: LIVEKIT_SECRET,
      identity: id,
      video,
    });
    await json({
      configured: true,
      url: LIVEKIT_URL,
      token: signed.token,
      room: streamId,
      canPublish: video.canPublish,
    });
    return;
  }

  if (url.pathname === "/functions/v1/tip-stream") {
    const body = request.postDataJSON?.() || {};
    const id = userIdFrom(request);
    state.tips.unshift({
      id: crypto.randomUUID(),
      stream_id: body.stream_id,
      tipper_id: id,
      host_id: state.stream.host_id,
      amount: Number(body.amount) || 0,
      message: body.message || null,
      created_at: new Date().toISOString(),
    });
    state.stream.total_tips += Number(body.amount) || 0;
    await json({ ok: true });
    return;
  }

  if (url.pathname.startsWith("/storage/v1/object/public/media/")) {
    const filePath = decodeURIComponent(url.pathname.replace("/storage/v1/object/public/media/", ""));
    const file = state.files.get(filePath);
    if (!file) {
      await route.fulfill({ status: 404, body: "missing" });
      return;
    }
    const range = request.headers()["range"] || "";
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    let status = 200;
    let body = file.bytes;
    const headers = {
      "access-control-allow-origin": "*",
      "content-type": file.type,
      "accept-ranges": "bytes",
      "content-length": String(file.bytes.length),
    };
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : file.bytes.length - 1;
      body = file.bytes.subarray(start, end + 1);
      status = 206;
      headers["content-range"] = `bytes ${start}-${end}/${file.bytes.length}`;
      headers["content-length"] = String(body.length);
    }
    await route.fulfill({ status, headers, body });
    return;
  }

  if (url.pathname === "/storage/v1/object/media" && request.method() === "DELETE") {
    const body = request.postDataJSON?.() || {};
    const prefixes = Array.isArray(body.prefixes) ? body.prefixes.map((prefix) => String(prefix)) : [];
    for (const prefix of prefixes) {
      for (const key of [...state.files.keys()]) {
        if (key === prefix || key.startsWith(`${prefix}/`)) state.files.delete(key);
      }
    }
    log(`removed media ${prefixes.join(",") || "(none)"}`);
    await json(prefixes.map((name) => ({ name })));
    return;
  }

  if (url.pathname.startsWith("/storage/v1/object/media/")) {
    const filePath = decodeURIComponent(url.pathname.replace("/storage/v1/object/media/", ""));
    const raw = request.postDataBuffer?.() || Buffer.alloc(0);
    const type = request.headers()["content-type"] || "video/webm";
    const file = fileFromUpload(raw, type);
    state.files.set(filePath, file);
    log(`stored ${filePath} ${file.bytes.length} bytes ${file.type} magic ${file.bytes.subarray(0, 4).toString("hex")}`);
    await json({ Key: filePath }, 200);
    return;
  }

  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const name = url.pathname.split("/").pop();
    if (name === "delete_own_live_stream") {
      const id = userIdFrom(request);
      const body = request.postDataJSON?.() || {};
      const target = typeof body.p_stream_id === "string" ? body.p_stream_id : "";
      const owned = [state.stream, state.child].filter(Boolean);
      const row = owned.find((item) => item.id === target);
      if (!id || !row || row.host_id !== id) {
        await json({ message: "You can only delete your own streams", code: "42501" }, 403);
        return;
      }
      if (row.is_live === true) {
        await json({ message: "End the live stream before deleting it", code: "42501" }, 403);
        return;
      }
      if (state.child && state.child.parent_event_id === target) state.child.parent_event_id = null;
      if (target === state.stream.id) state.deleted = true;
      else state.child = null;
      log(`rpc delete ${target}; child parent_event_id=${state.child?.parent_event_id ?? "gone"}`);
      await json(null);
      return;
    }
    await json(name === "blocked_peer_ids" ? [] : null);
    return;
  }

  const table = url.pathname.replace("/rest/v1/", "");
  if (!url.pathname.startsWith("/rest/v1/")) {
    await json([]);
    return;
  }

  if (request.method() === "GET" || request.method() === "HEAD") {
    const rows = rowsFor(state, table, request);
    if (wantsObject(request)) {
      await json(rows[0] ?? null, rows[0] ? 200 : 406);
      return;
    }
    await json(rows, 200, { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
    return;
  }

  if (request.method() === "PATCH" && (table === "live_streams" || table === "live_streams_public")) {
    const body = request.postDataJSON?.() || {};
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    const row = [state.stream, state.child].find((item) => item && (!id || item.id === id));
    if (!row) {
      await json(null, 406);
      return;
    }
    Object.assign(row, body);
    log(`stream patch ${row.id} ${JSON.stringify(body)}`);
    await json(wantsObject(request) ? row : [row]);
    return;
  }

  if (request.method() === "DELETE" && (table === "live_streams" || table === "live_streams_public")) {
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    const blocked = state.child && state.child.parent_event_id === id;
    if (blocked) {
      state.directDeleteBlocked = true;
      log("direct delete blocked by parent_event_id");
      await json({
        code: "23503",
        message: "update or delete on table \"live_streams\" violates foreign key constraint \"live_streams_parent_event_id_fkey\"",
      }, 409);
      return;
    }
    if (id === state.stream.id) state.deleted = true;
    if (state.child && id === state.child.id) state.child = null;
    await json([]);
    return;
  }

  if (request.method() === "POST") {
    const body = request.postDataJSON?.() || {};
    const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...body };
    if (table === "stream_chat") state.chat.push(row);
    if (table === "stream_reactions") state.reactions.unshift(row);
    if (table === "stream_tips") state.tips.unshift(row);
    if (table === "stream_gifts") state.gifts.unshift(row);
    await json(wantsObject(request) ? row : [row], 201);
    return;
  }

  await json([]);
}

async function install(context, userId, name, email, state, log) {
  const session = sessionFor(userId, name, email);
  await context.addInitScript((stored) => {
    try {
      localStorage.setItem(stored.key, JSON.stringify(stored.session));
      localStorage.setItem(`welcome_shown_${stored.session.user.id}`, "true");
    } catch {
      /* about:blank has no storage */
    }
  }, { session, key: "sb-127-auth-token" });
  await context.route(`${API}/**`, (route) => handleApi(route, state, log));
  context.on("page", (page) => {
    page.on("console", (message) => log(`[${name} console] ${message.type()} ${message.text()}`));
    page.on("pageerror", (error) => log(`[${name} pageerror] ${error.message}`));
  });
}

async function shot(page, file) {
  const target = path.join(OUT, file);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

async function waitForFrames(page, testId) {
  await page.waitForFunction((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return el instanceof HTMLVideoElement && el.videoWidth > 0 && el.readyState >= 2;
  }, testId, { timeout: 45_000 });
  return page.locator(`[data-testid="${testId}"]`).evaluate((el) => ({
    width: el.videoWidth,
    height: el.videoHeight,
    readyState: el.readyState,
  }));
}

async function prove(browserType, label) {
  const logLines = [];
  const log = (line) => {
    const text = `${label} ${line}`;
    logLines.push(text);
    console.log(text);
  };
  const state = freshState();
  const browser = await browserType.launch({
    headless: true,
    args: label === "chromium"
      ? [
          "--use-fake-ui-for-media-stream",
          "--use-fake-device-for-media-stream",
          "--autoplay-policy=no-user-gesture-required",
        ]
      : [],
  });
  const phone = {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: IPHONE,
    ...(label === "chromium" ? { permissions: ["camera", "microphone"] } : {}),
  };
  const hostContext = await browser.newContext(phone);
  const viewerContext = await browser.newContext(phone);
  await install(hostContext, HOST_ID, "Cadre Wallace", "cadre@ether.test", state, log);
  await install(viewerContext, VIEWER_ID, "Nico Lane", "nico@ether.test", state, log);
  const host = await hostContext.newPage();
  const viewer = await viewerContext.newPage();
  const result = { label, shots: [], video: null, replay: null, deleted: false };

  try {
    await host.goto(`${APP}/live?stream=${STREAM_ID}`, { waitUntil: "domcontentloaded" });
    await host.getByTestId("go-live").waitFor({ timeout: 20_000 });
    const saveSwitch = host.getByRole("switch", { name: "Save replay" });
    await saveSwitch.waitFor({ timeout: 20_000 });
    const saveOn = await saveSwitch.getAttribute("aria-checked");
    if (saveOn !== "false") throw new Error(`Save replay started ${saveOn}`);
    await host.getByText("Uploads when you end (under 50 MB). Anyone can watch it in Replays.").waitFor();
    await saveSwitch.click();
    if ((await saveSwitch.getAttribute("aria-checked")) !== "true") {
      throw new Error("Save replay did not turn on");
    }
    const deleteHits = await host.evaluate(() => {
      return [...document.querySelectorAll("[data-testid='delete-stream']")].map((button) => {
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const onScreen = x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight;
        const hit = onScreen ? document.elementFromPoint(x, y) : null;
        return {
          suppressed: button.closest("[data-suppressed='true']") !== null,
          onScreen,
          hitIsSelf: !!hit && (hit === button || button.contains(hit)),
        };
      });
    });
    const clickable = deleteHits.filter((row) => row.hitIsSelf);
    if (clickable.length !== 1 || clickable[0].suppressed) {
      throw new Error(`expected one visible delete, saw ${JSON.stringify(deleteHits)}`);
    }
    if (deleteHits.some((row) => row.suppressed && row.hitIsSelf)) {
      throw new Error(`hidden delete caught a tap ${JSON.stringify(deleteHits)}`);
    }
    await host.locator("[data-suppressed='false'] [data-testid='delete-stream']").click();
    await host.getByTestId("confirm-delete-stream").waitFor();
    await host.getByRole("button", { name: "Cancel" }).click();
    await host.getByTestId("confirm-delete-stream").waitFor({ state: "hidden" });
    await shot(host, `${label}-host-before.png`);
    await host.getByTestId("go-live").click();
    await host.getByTestId("live-badge").waitFor({ timeout: 30_000 });
    result.video = { host: await waitForFrames(host, "host-video") };
    await shot(host, `${label}-host-live.png`);

    await viewer.goto(`${APP}/live?stream=${STREAM_ID}`, { waitUntil: "domcontentloaded" });
    result.video.viewer = await waitForFrames(viewer, "viewer-video");
    await shot(viewer, `${label}-viewer-video.png`);
    result.shots.push(`${label}-viewer-video.png`);

    await viewer.getByTestId("chat-input").fill("hello from the phone");
    await viewer.getByTestId("chat-send").click();
    await host.getByText("hello from the phone").waitFor({ timeout: 4_000 });
    await host.getByTestId("chat-input").fill("host hears you");
    await host.getByTestId("chat-send").click();
    await viewer.getByText("host hears you").waitFor({ timeout: 4_000 });

    await viewer.locator('[data-testid="reaction-❤️"]').click();
    await host.getByTestId("cheer-log").getByText("❤️").waitFor({ timeout: 12_000 });
    await host.locator('[data-testid="reaction-🔥"]').click();
    await viewer.getByTestId("cheer-log").getByText("🔥").waitFor({ timeout: 12_000 });
    await shot(host, `${label}-host-chat.png`);
    await shot(viewer, `${label}-viewer-chat.png`);

    await host.getByTestId("end-stream").click();
    await host.getByTestId("confirm-end-stream").click();
    await host.getByTestId("stream-finished").waitFor({ timeout: 20_000 });
    await host.getByTestId("save-to-phone").waitFor({ timeout: 10_000 });
    if (!state.stream.replay_url || !state.stream.replay_available) {
      throw new Error(`replay was not stored: ${state.stream.replay_url || "none"}`);
    }
    const storedReplay = [...state.files.values()].find((file) => file.type.includes("webm"));
    if (storedReplay) {
      const { readWebmDurationMs } = await import("../src/lib/webmDuration.ts");
      const duration = readWebmDurationMs(storedReplay.bytes);
      result.replayDuration = duration;
      log(`replay duration ${duration}`);
      if (!(duration > 0) || !Number.isFinite(duration)) {
        throw new Error(`replay duration was ${duration}`);
      }
    }
    await viewer.getByTestId("replay-video").waitFor({ timeout: 15_000 });
    await viewer.getByTestId("replay-video").click();
    result.replay = await waitForFrames(viewer, "replay-video");
    await shot(viewer, `${label}-replay.png`);
    await shot(host, `${label}-host-ended.png`);

    await host.getByTestId("close-finished").click();
    await host.getByTestId("stream-finished").waitFor({ state: "hidden", timeout: 10_000 });
    await host.getByRole("tab", { name: "Browse" }).click();
    await host.getByText("1 Replays").waitFor({ timeout: 10_000 });
    const parentCard = host.getByTestId(`stream-card-${STREAM_ID}`);
    const childCard = host.getByTestId(`stream-card-${CHILD_ID}`);
    await parentCard.waitFor();
    await childCard.waitFor();
    const statusText = (await parentCard.getByTestId("stream-status").innerText()).replace(/\s+/g, " ").trim();
    if (statusText !== "Replay") throw new Error(`browse status badge was ${JSON.stringify(statusText)}`);
    const childStatus = (await childCard.getByTestId("stream-status").innerText()).replace(/\s+/g, " ").trim();
    if (childStatus !== "Ended") throw new Error(`child status badge was ${JSON.stringify(childStatus)}`);
    await shot(host, `${label}-browse-badge.png`);
    const replayUrl = state.stream.replay_url;
    await parentCard.getByTestId("delete-stream").click();
    await host.getByTestId("confirm-delete-stream").click();
    await parentCard.waitFor({ state: "hidden", timeout: 10_000 });
    await childCard.waitFor();
    const removedStatus = await host.evaluate(async (url) => {
      const response = await fetch(url);
      return response.status;
    }, replayUrl);
    if (removedStatus !== 404 && removedStatus !== 400) {
      throw new Error(`replay stayed public at ${removedStatus} for ${replayUrl}`);
    }
    result.replayRemoved = removedStatus;
    result.deleted = state.deleted === true && state.child?.parent_event_id === null;
    await shot(host, `${label}-deleted.png`);
    if (!result.deleted) {
      throw new Error(`delete left parent=${state.deleted} child parent_event_id=${state.child?.parent_event_id ?? "gone"}`);
    }
  } catch (error) {
    await shot(host, `${label}-failure-host.png`).catch(() => undefined);
    await shot(viewer, `${label}-failure-viewer.png`).catch(() => undefined);
    throw error;
  } finally {
    await writeFile(path.join(OUT, `${label}.log`), logLines.join("\n"));
    await browser.close();
  }
  return result;
}

async function proveDenied(browserType) {
  const state = freshState();
  const log = () => {};
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: IPHONE,
  });
  await install(context, HOST_ID, "Cadre Wallace", "cadre@ether.test", state, log);
  await context.addInitScript(() => {
    const deny = () => {
      const error = new Error("Permission denied");
      error.name = "NotAllowedError";
      return Promise.reject(error);
    };
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = deny;
  });
  const page = await context.newPage();
  await page.goto(`${APP}/live?stream=${STREAM_ID}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("go-live").click();
  await page.getByTestId("camera-denied").waitFor({ timeout: 15_000 });
  await shot(page, "chromium-camera-denied.png");
  await browser.close();
}

const only = process.env.LIVE_E2E_BROWSER;
const browsers = [
  ["chromium", chromium],
  ["webkit", webkit],
].filter(([name]) => !only || only === name);

await mkdir(OUT, { recursive: true });
const results = [];
let failed = false;
for (const [name, type] of browsers) {
  try {
    results.push(await prove(type, name));
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${name} failed: ${message}`);
    results.push({ label: name, error: message });
  }
}
if (!only || only === "chromium") {
  try {
    await proveDenied(chromium);
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`camera-denied failed: ${message}`);
    results.push({ label: "camera-denied", error: message });
  }
}
await writeFile(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (failed) process.exit(1);
