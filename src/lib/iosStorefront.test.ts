import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { visibleMoreItems, visibleMoreItemsForStorefront } from "./appNavVisibility.ts";
import { checkoutOrigin } from "../../supabase/functions/_shared/checkout-origin.mjs";
import {
  EXTERNAL_CHECKOUT_HOSTS,
  checkoutReturnPath,
  externalCheckoutUrlAllowed,
  isUsStorefront,
} from "./iosStorefront.ts";

describe("US storefront checkout", () => {
  it("treats only the USA storefront code as a link-out", () => {
    assert.equal(isUsStorefront("USA"), true);
    assert.equal(isUsStorefront(" usa "), true);
    assert.equal(isUsStorefront("US"), false);
    assert.equal(isUsStorefront("GBR"), false);
    assert.equal(isUsStorefront(""), false);
    assert.equal(isUsStorefront(null), false);
    assert.equal(isUsStorefront(undefined), false);
  });

  it("allows Stripe and the Ether site, and nothing else", () => {
    assert.equal(externalCheckoutUrlAllowed("https://checkout.stripe.com/c/pay/cs_test_123"), true);
    assert.equal(externalCheckoutUrlAllowed("https://billing.stripe.com/p/session/test"), true);
    assert.equal(externalCheckoutUrlAllowed("https://etherbylcove.com/membership"), true);
    assert.equal(externalCheckoutUrlAllowed("https://www.etherbylcove.com/fund"), true);
    assert.equal(externalCheckoutUrlAllowed("http://checkout.stripe.com/c/pay/cs_test_123"), false);
    assert.equal(externalCheckoutUrlAllowed("https://evil.example/checkout"), false);
    assert.equal(externalCheckoutUrlAllowed("capacitor://localhost/membership"), false);
  });

  it("returns only membership and fund links into the app", () => {
    assert.equal(
      checkoutReturnPath("https://etherbylcove.com/membership?success=true&tier=community"),
      "/membership?success=true&tier=community",
    );
    assert.equal(checkoutReturnPath("https://www.etherbylcove.com/fund?donated=true"), "/fund?donated=true");
    assert.equal(checkoutReturnPath("https://etherbylcove.com/cinema"), null);
    assert.equal(checkoutReturnPath("https://checkout.stripe.com/c/pay/cs_test_123"), null);
    assert.equal(checkoutReturnPath("http://etherbylcove.com/membership"), null);
  });

  it("honors the public site as the only requested return origin", () => {
    assert.equal(checkoutOrigin("https://etherbylcove.com", "capacitor://localhost", "http://localhost:3000"), "https://etherbylcove.com");
    assert.equal(checkoutOrigin("https://evil.example", "https://etherbylcove.com", "http://localhost:3000"), "https://etherbylcove.com");
    assert.equal(checkoutOrigin(undefined, "http://localhost:5173", "http://localhost:3000"), "http://localhost:5173");
    assert.equal(checkoutOrigin(undefined, "", "https://etherbylcove.com"), "https://etherbylcove.com");
    assert.equal(checkoutOrigin("https://etherbylcove.com/", "https://web.example", "http://localhost:3000"), "https://web.example");
  });

  it("keeps membership hidden in More until the storefront is USA", () => {
    const items = [
      { id: "store", iosHidden: false },
      { id: "fund", iosHidden: false },
      { id: "membership", iosHidden: true },
    ];
    assert.equal(visibleMoreItems(items, true).some((item) => item.id === "membership"), false);
    assert.equal(visibleMoreItemsForStorefront(items, true, false).some((item) => item.id === "membership"), false);
    assert.equal(visibleMoreItemsForStorefront(items, true, true).some((item) => item.id === "membership"), true);
    assert.equal(visibleMoreItemsForStorefront(items, false, false).some((item) => item.id === "membership"), true);
    assert.equal(visibleMoreItemsForStorefront(items, true, false).some((item) => item.id === "fund"), true);
  });

  it("opens Safari from the App target and publishes the return link", () => {
    const plugin = readFileSync("ios/App/App/EtherStorefrontPlugin.swift", "utf8");
    const bridge = readFileSync("ios/App/App/EtherBridgeViewController.swift", "utf8");
    const storyboard = readFileSync("ios/App/App/Base.lproj/Main.storyboard", "utf8");
    const entitlements = readFileSync("ios/App/App/App.entitlements", "utf8");
    const project = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
    const association = readFileSync("public/.well-known/apple-app-site-association", "utf8");
    assert.match(plugin, /UIApplication\.shared\.open/);
    assert.match(plugin, /ether-id-pass/);
    assert.match(plugin, /supabase\.co/);
    assert.equal(plugin.includes("SFSafariViewController"), false);
    assert.equal(plugin.includes("Storefront.current"), true);
    for (const host of EXTERNAL_CHECKOUT_HOSTS) {
      assert.equal(plugin.includes(`"${host}"`), true);
    }
    assert.match(bridge, /registerPluginInstance\(EtherStorefrontPlugin\(\)\)/);
    assert.match(storyboard, /customClass="EtherBridgeViewController" customModule="App"/);
    assert.match(entitlements, /applinks:etherbylcove\.com/);
    assert.equal(project.includes("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;"), true);
    assert.match(association, /926NTNU4M7\.app\.lovable\.e07d9c457fd949f78f3cc7d5998be668/);
    assert.match(association, /\/membership/);
    assert.match(association, /\/fund/);
  });
});
