import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const root = "http://127.0.0.1:8081";
const me = "00000000-0000-4000-8000-0000000000aa";
const peer = "00000000-0000-4000-8000-0000000000bb";
const tripId = "00000000-0000-4000-8000-0000000000cc";
const cities = [
  ["atlanta|ga", "Atlanta, GA", 12],
  ["charlotte|nc", "Charlotte, NC", 8],
  ["new york city|ny", "New York City, NY", 16],
  ["madrid|es", "Madrid, Spain", 7],
  ["los angeles|ca", "Los Angeles, CA", 11],
  ["london|gb", "London, UK", 5],
  ["tokyo|jp", "Tokyo, Japan", 4],
  ["sydney|au", "Sydney, Australia", 6],
].map(([city_key, label, count]) => ({ city_key, label, count, image: null }));
const people = [
  {
    user_id: peer,
    display_name: "Jordan Ellis",
    city: "Atlanta, GA",
    city_key: "atlanta|ga",
    bio: "Photographer and art director. Building stories through portraits, movement and light.",
    avatar_url: null,
    liked: null,
  },
  {
    user_id: "00000000-0000-4000-8000-0000000000dd",
    display_name: "Riley Chen",
    city: "Atlanta, GA",
    city_key: "atlanta|ga",
    bio: "Filmmaker and visual artist. Looking for collaborators for a short film.",
    avatar_url: null,
    liked: null,
  },
];
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
const dir = "docs/creative-discovery/screenshots";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const width of [390, 820, 1280]) {
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
      const fn = url.pathname.split("/rpc/")[1];
      if (fn) {
        const data = req.postDataJSON() || {};
        calls.push({ fn, data });
        if (fn === "discovery_people")
          body = {
            cities,
            people: data.p_query
              ? people.filter((p) =>
                  p.display_name
                    .toLowerCase()
                    .includes(data.p_query.toLowerCase())
                )
              : people,
          };
        if (fn === "discovery_settings")
          body = { discoverable: true, matches_only: true };
        if (fn === "creative_swipe")
          body = { matched: data.p_liked, conversation_id: tripId };
        if (fn === "creative_trip_list") body = [trip];
        if (fn === "creative_trip_snapshot") body = trip;
        if (fn === "creative_trip_action") body = trip;
      } else if (url.pathname.includes("/auth/"))
        return route.fulfill({ status: 401, headers, body: "{}" });
      await route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
    });
    await page.goto(root + "/directory");
    await page.getByRole("heading", { name: "Find your people." }).waitFor();
    await page.getByRole("heading", { name: "Jordan Ellis" }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      ),
      true
    );
    await page.screenshot({
      path: `${dir}/globe-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("button", { name: "Rotate globe east", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Select a city or state" })
      .selectOption("atlanta|ga");
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await page.getByText("You matched! Your chat is ready.").waitFor();
    assert(
      calls.some((c) => c.fn === "creative_swipe" && c.data.p_liked === true)
    );
    await page
      .getByRole("button", { name: "Discovery settings", exact: true })
      .click();
    const privacyRequest = page.waitForResponse(
      (r) =>
        r.url().includes("/rpc/discovery_settings") &&
        r.request().postDataJSON()?.p_matches_only === false
    );
    await page.getByRole("switch", { name: "Matches-only DMs" }).click();
    await privacyRequest;
    assert(
      calls.some(
        (c) => c.fn === "discovery_settings" && c.data.p_matches_only === false
      )
    );
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
      `PASS ${width}: globe/cities, match, DM setting, trip budget, pledge, creation dialog; no page errors or horizontal overflow`
    );
    await context.close();
  }
} finally {
  await browser.close();
}
