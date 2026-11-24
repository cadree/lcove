import assert from "node:assert/strict";
import test from "node:test";
import { musicPayoutUrls } from "../../supabase/functions/_shared/payout-urls.mjs";

test("Connect uses HTTPS return links for iPhone, Android and missing Origins", () => {
  for (const origin of [null, "", "null", "capacitor://localhost", "http://localhost", "https://localhost", "https://attacker.example"]) {
    const links = musicPayoutUrls({ origin });
    assert.equal(links.return_url, "https://etherbylcove.com/profile?music_payouts=success");
    assert.equal(links.refresh_url, "https://etherbylcove.com/profile?music_payouts=refresh");
  }
  assert.equal(musicPayoutUrls({ origin: "https://www.etherbylcove.com" }).return_url,
    "https://www.etherbylcove.com/profile?music_payouts=success");
});

test("a configured staging website is kept separate from production", () => {
  const config = { origin: "capacitor://localhost", siteUrl: "https://ether-staging.example/path/", appUrl: "capacitor://localhost" };
  assert.equal(musicPayoutUrls(config).return_url, "https://ether-staging.example/profile?music_payouts=success");
  assert.equal(musicPayoutUrls({ siteUrl: "not a URL", appUrl: "https://app.example" }).refresh_url,
    "https://app.example/profile?music_payouts=refresh");
});
