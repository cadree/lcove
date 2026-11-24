import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const root = "http://127.0.0.1:8081";
const me = "00000000-0000-4000-8000-0000000000aa";
const peer = "00000000-0000-4000-8000-0000000000bb";
const tripId = "00000000-0000-4000-8000-0000000000cc";
const svg = (seed) => {
  const hue = (seed * 47) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},35%,18%)"/></linearGradient></defs><rect width="600" height="800" fill="url(#g)"/><ellipse cx="300" cy="330" rx="118" ry="140" fill="hsl(${(hue + 40) % 360},30%,14%)"/><rect x="60" y="470" width="480" height="420" rx="210" fill="hsl(${(hue + 40) % 360},30%,14%)"/></svg>`;
};
const avatar = (n) => `https://fixture.supabase.co/storage/v1/object/public/avatars/p${n}.svg`;
const member = (n, name, city, skill, bio) => ({
  user_id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
  display_name: name, avatar_url: avatar(n), city, city_display: city, city_key: null,
  bio, created_at: "2026-10-01T00:00:00Z", skill,
});
const members = [
  { ...member(0, "Maya Torres", "Charlotte, NC", "Photography", "Portrait and street."), user_id: me },
  { ...member(1, "Jordan Ellis", "Atlanta, GA", "Photography", "Photographer and art director. Building stories through portraits, movement and light."), user_id: peer },
  member(2, "Riley Chen", "Atlanta, GA", "Film", "Filmmaker and visual artist. Looking for collaborators for a short film."),
  member(3, "Rezza Amiri", "Charlotte, NC", "Music production", "Producer. Hidden from the globe, still in the directory."),
  member(4, "Nia Brooks", "charlotte, nc", "Styling", "Wardrobe stylist for editorials and music videos."),
  member(5, "Marcus Lee", "Charlotte", "Music production", "Beats, mixing and late-night sessions."),
  member(6, "Ama Owusu", "Lagos, Nigeria", "Graphic design", "Type, posters and identity systems."),
  member(7, "Léa Martin", "Paris, France", "Painting", "Oil painter. Big canvases, small studio."),
  member(8, "Kenji Sato", "Tokyo, Japan", "Animation", "2D animator and illustrator."),
  member(9, "Sofia Ruiz", "Madrid, Spain", "Dance", "Choreographer working between Madrid and Mexico City."),
  member(10, "Dev Patel", "London, UK", "Writing", "Screenwriter. Comedy and family drama."),
  member(11, "Camila Souza", "São Paulo, Brazil", "Photography", "Documentary photographer."),
  member(12, "Zoe King", "Los Angeles, CA", "Acting", "Actor and voice artist."),
  member(13, "Theo Grant", "New York, NY", "Creative direction", "Brand and campaign creative director."),
  member(14, "Imani Cole", "Miami, FL", "Modeling", "Model and content creator."),
];
const hidden = new Set([members[3].user_id]);
const signals = members
  .filter((m) => !hidden.has(m.user_id))
  .map((m) => ({ user_id: m.user_id, liked: null, live_city_key: null, live_until: null, trip: null }));
signals.find((s) => s.user_id === peer).trip = { city_key: "miami|fl", city_label: "Miami, FL", starts_on: "2026-11-19", ends_on: "2026-11-23" };
Object.assign(signals.find((s) => s.user_id === members[5].user_id), { live_city_key: "miami|fl", live_until: "2099-01-01T00:00:00Z" });
const trip = {
  id: tripId,
  organizer_id: me,
  city_key: "atlanta|ga",
  city_label: "Atlanta, GA",
  title: "Creative weekend in Atlanta",
  starts_on: "2027-02-19",
  ends_on: "2027-02-22",
  capacity: 4,
  notes:
    "Portrait walks, shared lodging and creative dinners. Discuss refunds before booking.",
  status: "planning",
  conversation_id: tripId,
  joined: true,
  member_count: 2,
  roster: [
    { user_id: me, display_name: "Maya Torres" },
    { user_id: peer, display_name: "Jordan Ellis" },
  ],
  revision: 3,
  total_cents: 200000,
  members: [
    {
      user_id: me,
      display_name: "Maya Torres",
      share_cents: 100000,
      pledge_cents: 0,
      reported_paid_cents: 0,
      approved_revision: null,
    },
    {
      user_id: peer,
      display_name: "Jordan Ellis",
      share_cents: 100000,
      pledge_cents: 100000,
      reported_paid_cents: 0,
      approved_revision: 3,
    },
  ],
  items: [
    {
      id: me,
      label: "Lodging including taxes",
      estimate_cents: 150000,
      quote_url: "https://example.com/lodging",
      receipt_url: null,
      actual_cents: null,
      votes: [],
    },
    {
      id: peer,
      label: "Car rental",
      estimate_cents: 50000,
      quote_url: "",
      receipt_url: null,
      actual_cents: null,
      votes: [],
    },
  ],
  audit: [],
};
const dir = process.env.SHOTS_DIR || "docs/creative-discovery/screenshots";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const width of (process.env.WIDTHS || "390,820,1280").split(",").map(Number)) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
    });
    const page = await context.newPage();
    const calls = [];
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem("ether-shot-user", "1");
      localStorage.setItem(
        "welcome_shown_00000000-0000-4000-8000-0000000000aa",
        "true"
      );
    });
    await page.route("**/*supabase.co/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods":
          "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS",
        "content-type": "application/json",
      };
      if (req.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      let body = [];
      let settings = { discoverable: true, matches_only: true, live_city_key: null, live_until: null };
      if (url.pathname.includes("/storage/v1/object/public/"))
        return route.fulfill({ status: 200, headers: { ...headers, "content-type": "image/svg+xml" }, body: svg(Number(url.pathname.match(/(\d+)\.svg$/)?.[1] || 0)) });
      const table = url.pathname.split("/rest/v1/")[1];
      if (table === "profiles_public") body = members.map(({ skill, ...m }) => m);
      if (table === "user_skills") body = members.map((m) => ({ user_id: m.user_id, skills: { name: m.skill } }));
      if (table === "portfolio_items") {
        const owner = members.findIndex((m) => url.searchParams.get("user_id") === `eq.${m.user_id}`);
        body = [1, 2, 3].map((k) => ({ id: `${owner}-${k}`, title: `Work ${k}`, media_type: "image", media_url: avatar((owner + k * 5) % 15), thumbnail_url: avatar((owner + k * 5) % 15) }));
      }
      const fn = url.pathname.split("/rpc/")[1];
      if (fn) {
        const data = req.postDataJSON() || {};
        calls.push({ fn, data });
        if (fn === "discovery_globe") body = signals;
        if (fn === "discovery_settings") body = { ...settings, matches_only: data.p_matches_only ?? true };
        if (fn === "discovery_live_city") body = { ...settings, live_city_key: data.p_city_key, live_until: data.p_city_key ? "2099-01-01T00:00:00Z" : null };
        if (fn === "creative_match_list") body = [];
        if (fn === "blocked_peer_ids") body = [];
        if (fn === "creative_swipe")
          body = { matched: data.p_liked, conversation_id: tripId };
        if (fn === "creative_trip_list") body = [trip];
        if (fn === "creative_trip_snapshot") body = trip;
        if (fn === "creative_trip_action") body = trip;
      } else if (url.pathname.includes("/auth/"))
        return route.fulfill({ status: 401, headers, body: "{}" });
      await route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
    });
    const noOverflow = async () =>
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    // /directory is the people section of Explore now.
    await page.goto(root + "/directory");
    await page.waitForURL(/\/explore\?section=people/);
    await page.goto(root + "/explore");
    await page.getByRole("heading", { name: "Find your people" }).waitFor();
    // Charlotte, Atlanta, Miami and New York overlap at full-globe zoom and fold into one cluster.
    const cluster = page.getByRole("button", { name: /nearby cities: \d+ members\. Zoom in$/ }).first();
    await cluster.waitFor();
    // Live members lead the deck.
    await page.getByRole("article", { name: /^Marcus Lee, Music production, Miami, FL$/ }).waitFor();
    await page.getByText("Traveling to Miami Nov 19–23").first().waitFor();
    await noOverflow();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/explore-${width}.png`, fullPage: true, animations: "disabled" });
    // The Novi guide sheet used to draw its own X on top of the sheet's built-in one.
    const visibleCloses = (el) =>
      [...el.querySelectorAll("button")].filter((b) => b.querySelector("svg.lucide-x") && b.offsetParent !== null).length;
    await page.getByRole("button", { name: "Ask Novi" }).first().click();
    const guide = page.getByRole("dialog");
    await guide.waitFor();
    await page.waitForTimeout(400);
    assert.equal(await guide.evaluate(visibleCloses), 1, "Novi guide shows exactly one close X");
    await page.screenshot({ path: `${dir}/novi-guide-single-x-${width}.png`, animations: "disabled" });
    await page.keyboard.press("Escape");
    await guide.waitFor({ state: "detached" });
    const markerLabels = () => page.locator("[data-city-marker]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    for (let i = 0; i < 3 && !(await markerLabels()).includes("Charlotte, NC: 2 members"); i++)
      await page.getByRole("button", { name: /^(Charlotte|Atlanta).*Zoom in$/ }).first().click();
    assert((await markerLabels()).includes("Charlotte, NC: 2 members"), JSON.stringify(await markerLabels()));
    await page.screenshot({ path: `${dir}/explore-globe-zoomed-${width}.png`, animations: "disabled" });
    await page.getByRole("combobox", { name: "Select a city or state" }).selectOption("miami|fl");
    await page.getByRole("button", { name: /^Miami, FL: 2 members, 1 here live$/ }).waitFor();
    await page.getByRole("article", { name: /^Marcus Lee, Music production, Miami, FL/ }).waitFor();
    await page.getByRole("heading", { name: "Everyone in Miami, FL · 3" }).waitFor();
    // The hidden member is in the list and search, never on the globe or deck.
    await page.getByRole("button", { name: "Global", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search people, cities, stores" }).fill("rezza");
    await page.getByRole("link", { name: /Rezza Amiri/ }).waitFor();
    assert.equal(await page.getByRole("article", { name: /Rezza/ }).count(), 0);
    await page.getByRole("searchbox", { name: "Search people, cities, stores" }).fill("");
    await page.getByRole("combobox", { name: "Select a city or state" }).selectOption("charlotte|nc");
    await page.getByRole("heading", { name: "Everyone in Charlotte, NC · 4" }).waitFor();
    await page.getByRole("button", { name: "Nearby", exact: true }).click();
    await page.getByRole("heading", { name: "Everyone in Charlotte, NC · 4" }).waitFor();
    await page.getByRole("button", { name: "Global", exact: true }).click();
    await page.getByRole("button", { name: "Show Jordan" }).click();
    await page.getByRole("article", { name: /^Jordan Ellis, Photography, Atlanta, GA$/ }).waitFor();
    await page.getByRole("button", { name: "Like Jordan Ellis", exact: true }).click();
    await page.getByText("You and Jordan Ellis matched. Your chat is ready.").waitFor();
    assert(calls.some((c) => c.fn === "creative_swipe" && c.data.p_target === peer && c.data.p_liked === true));
    await page.getByRole("button", { name: "Discovery settings", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await page.waitForTimeout(400);
    const closeButtons = await dialog.evaluate(visibleCloses);
    assert.equal(closeButtons, 1, "settings dialog shows exactly one close X");
    await page.screenshot({ path: `${dir}/explore-settings-dialog-${width}.png`, animations: "disabled" });
    await dialog.getByRole("textbox", { name: "Live city" }).fill("Miami");
    await dialog.getByRole("button", { name: "Miami, FL", exact: true }).click();
    await page.waitForResponse((r) => r.url().includes("/rpc/discovery_live_city"));
    assert(calls.some((c) => c.fn === "discovery_live_city" && c.data.p_city_key === "miami|fl" && c.data.p_hours === 24 && Object.keys(c.data).every((k) => k === "p_city_key" || k === "p_hours")));
    const privacyRequest = page.waitForResponse(
      (r) => r.url().includes("/rpc/discovery_settings") && r.request().postDataJSON()?.p_matches_only === false
    );
    await dialog.getByRole("switch", { name: "Matches-only DMs" }).click();
    await privacyRequest;
    await page.keyboard.press("Escape");
    await page.goto(root + "/explore?section=people");
    await page.getByRole("heading", { name: /^Everyone · 15$/ }).waitFor();
    await noOverflow();
    await page.screenshot({ path: `${dir}/explore-people-${width}.png`, fullPage: true, animations: "disabled" });
    await page.goto(root + `/travel?trip=${tripId}`);
    await page.getByRole("heading", { name: trip.title }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      ),
      true
    );
    await page.screenshot({
      path: `${dir}/trip-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    const pledgeRequest = page.waitForResponse(
      (r) =>
        r.url().includes("/rpc/creative_trip_action") &&
        r.request().postDataJSON()?.p_action === "pledge"
    );
    await page
      .getByRole("button", { name: "Pledge my $1,000.00 share", exact: true })
      .click();
    await pledgeRequest;
    assert(
      calls.some(
        (c) =>
          c.fn === "creative_trip_action" &&
          c.data.p_action === "pledge" &&
          c.data.p_data.cents === 100000
      )
    );
    await page
      .getByRole("button", { name: "Plan a trip", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(350);
    await page.screenshot({
      path: `${dir}/create-trip-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByLabel("Trip name", { exact: true })
      .fill("Atlanta creative weekend");
    await page
      .getByRole("combobox", { name: "City", exact: true })
      .fill("Atlanta, GA");
    await page.getByLabel("Arrival", { exact: true }).fill("2027-02-19");
    await page.getByLabel("Departure", { exact: true }).fill("2027-02-22");
    await page.getByLabel("Maximum travelers, including you").fill("4");
    await page
      .getByLabel("Plan & cancellation expectations")
      .fill(
        "Photography weekend. Split lodging and transport, agree cancellation costs first."
      );
    const created = page.waitForResponse(
      (r) =>
        r.url().includes("/rpc/creative_trip_action") &&
        r.request().postDataJSON()?.p_action === "create"
    );
    await page
      .getByRole("button", { name: "Create trip & group chat", exact: true })
      .click();
    await created;
    assert(
      calls.some(
        (c) =>
          c.fn === "creative_trip_action" &&
          c.data.p_action === "create" &&
          c.data.p_data.city_key === "atlanta|ga" &&
          c.data.p_data.request_id
      )
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}: explore globe markers, swipe deck, search finds hidden member in list only, city picker, like/match, single-X settings dialog, live city (key only), DM setting, trip budget, pledge, creation dialog; no page errors or horizontal overflow`
    );
    await context.close();
  }
} finally {
  await browser.close();
}
