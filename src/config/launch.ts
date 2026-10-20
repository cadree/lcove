/**
 * Pre-launch. While this is true, public Join actions open /waitlist.
 * Sign in stays on /auth. Set this to false when signup should open again.
 */
export const WAITLIST_MODE = true;

/**
 * Set when the App Store listing exists. Empty keeps the smart banner off
 * and shows "on the web now, iPhone app coming" instead of a link.
 */
export const APP_STORE_URL = "";

/**
 * Numeric App Store id for `<meta name="apple-itunes-app">`.
 * Leave empty until the listing exists. The smart banner stays off without it.
 */
export const APP_STORE_APPLE_ID = "";

/**
 * Replace with the Apple Team ID before universal links work.
 * Used only in /.well-known/apple-app-site-association.
 */
export const APPLE_TEAM_ID = "TEAMID";

export const NATIVE_BUNDLE_ID = "com.etherbylcove.app";

/** Hidden when empty. */
export const INSTAGRAM_URL = "https://www.instagram.com/_familcy/";

/**
 * Slack invite. Expires around 3 Nov 2026. This is the only copy of the URL.
 * Set it to "" to hide the link.
 */
export const SLACK_URL =
  "https://join.slack.com/t/nuancebylcove/shared_invite/zt-4c0bpdec1-2p6u4pNi00oVRxQCza98MQ";

export const PRIVACY_EMAIL = "privacy@etherbylcove.com";
export const LEGAL_EMAIL = "legal@etherbylcove.com";
export const SUPPORT_EMAIL = "support@etherbylcove.com";

export const SITE_ORIGIN = "https://etherbylcove.com";
