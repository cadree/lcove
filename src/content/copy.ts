/**
 * Campaign lines. Use these sentences as written.
 * HERO_TAGLINE is also the meta description in index.html and public/manifest.json.
 */
import { AI_CONTENT_RULE_ALLOWED, AI_CONTENT_RULE_FORBIDDEN } from "../lib/aiContentRule.ts";
export const HERO_TAGLINE = "Real creatives. Real work.";

export const SUPPORT_LINE =
  "A home for creatives where every face is real and every post is real work.";

export const WELCOME_HOME = "Welcome home, Familcy.";

export const NO_FAKE_LINE = "No fake people. No fake work.";

/** Shown after a waitlist submit. Do not add a count. */
export const WAITLIST_CONFIRMATION = WELCOME_HOME;

/** First screen of the onboarding quiz. The quiz is still required. */
export const QUIZ_INTRO_COPY = SUPPORT_LINE;

/** Under the waitlist email field, and the waitlist section of the privacy policy. */
export const WAITLIST_PRIVACY_NOTE =
  "We use this email only to tell you when Ether opens.";

/** Shown next to the Slack link. Hidden when SLACK_URL is empty. */
export const SLACK_INTRO = "Introduce yourself in #start-here.";

/** Shown instead of an App Store link while APP_STORE_URL is empty. */
export const APP_STORE_COMING = "on the web now, iPhone app coming";

export const INVITE_EMAIL_SUBJECT = WELCOME_HOME;

export const INVITE_EMAIL_LINES = [
  HERO_TAGLINE,
  SUPPORT_LINE,
  NO_FAKE_LINE,
  SLACK_INTRO,
] as const;

/** Landing summary of Cadre's guidelines rule. The two sentences stay in aiContentRule. */
export const GENERATIVE_AI_RULE = `${AI_CONTENT_RULE_ALLOWED} ${AI_CONTENT_RULE_FORBIDDEN}`;
