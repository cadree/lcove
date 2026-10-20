/**
 * Pre-launch. While this is true, public Join actions open /waitlist.
 * Sign in stays on /auth. Set this to false when signup should open again.
 */
export const WAITLIST_MODE = true;

/**
 * Set when the App Store listing exists. An empty string hides the badge
 * and the iOS smart banner.
 */
export const APP_STORE_URL = "";

/**
 * Numeric App Store id for `<meta name="apple-itunes-app">`.
 * Leave empty until the listing exists. The smart banner stays off without it.
 */
export const APP_STORE_APPLE_ID = "";

/**
 * TODO(Cadre): replace with the Apple Team ID before universal links work.
 * Used only in /.well-known/apple-app-site-association.
 */
export const APPLE_TEAM_ID = "TEAMID";

export const NATIVE_BUNDLE_ID = "com.etherbylcove.app";

/** TODO(Cadre): Instagram profile URL. Hidden until this is a real URL. */
export const INSTAGRAM_URL = "";

/** TODO(Cadre): Slack invite or workspace URL. Hidden until this is a real URL. */
export const SLACK_URL = "";

export const PRIVACY_EMAIL = "privacy@etherbylcove.com";
export const LEGAL_EMAIL = "legal@etherbylcove.com";
export const SUPPORT_EMAIL = "support@etherbylcove.com";

export const SITE_ORIGIN = "https://etherbylcove.com";
