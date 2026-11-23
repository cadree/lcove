/**
 * Campaign lines. Use these sentences as written.
 * OG_DESCRIPTION is also the meta description in index.html and public/manifest.json.
 */
export const HERO_TAGLINE = "A culture of aspirations";

export const HERO_LEAD = "Ether is a culture of aspirations.";

export const HERO_SUB =
  "A home for creatives. Real people, not bots. Real work, not AI slop. No algorithm.";

export const OG_DESCRIPTION =
  "Ether is a culture of aspirations. An app with real people and no algorithms. Real people, not bots. Real work, not AI slop.";

export const SUPPORT_LINE =
  "A home for creatives where every face is real and every post is real work.";

export const WELCOME_HOME = "Welcome home, Familcy.";

export const NO_FAKE_LINE = "No fake people. No fake work.";

/** Shown after a waitlist submit. Do not add a count. */
export const WAITLIST_CONFIRMATION = WELCOME_HOME;

/** First screen of the onboarding quiz. The quiz is still required if that screen is shown. */
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

/** Landing feature section. One title only. */
export const FEATURE_PREVIEW_LABEL = "Inside Ether";

export const FEATURE_PREVIEW = [
  {
    title: "Social media for the creative culture",
    line: "No algorithm, no popularity contest. Real people, real connections.",
  },
  {
    title: "Throw your own event",
    line: "Tickets or RSVP, your branding on everything, you keep 100%.",
  },
  {
    title: "Find your crew",
    line: "Post a project and real creatives apply to build it with you.",
  },
] as const;

/** Confirm-email step after sign-up. */
export const VERIFY_SIGNAL_TITLE = "Verify your email";

export const VERIFY_SIGNAL_BODY =
  "Enter the 6-digit code we sent you. The email link still works.";

export const EMAIL_CONFIRMED_TITLE = "Email confirmed — sign in";

export const EMAIL_CONFIRMED_BODY = "Your email is verified. Sign in to continue.";

/** Community greeting. Pronounced loo-so-ve. Love, hello, or goodbye. */
export const LCOVE_GREETING = "Lcove";

export const LCOVE_GLOSS = "loo-so-ve — love, hello, goodbye";

/** Welcome into the family. Pronounced fam-li-see. */
export const FAMILCY_WELCOME = "Welcome to the Familcy";

export const FAMILCY_GLOSS = "fam-li-see — family";

/** Belief pledge that replaces the first-run quiz. Values follow the culture amendments, in short form. */
export const OATH_KICKER = "The oath to enter";

export const OATH_TITLE = "What this place stands for";

export const OATH_MISSION = "A path for genuine creatives to follow their passions.";

export const OATH_LINES = [
  "An open mindset that allows growth.",
  "No negative energy into the community or your heart.",
  "Harmony in your self-interest, to benefit others.",
  "Support your peers' work first.",
  "Let the culture be your asset. Your connections can change someone's life.",
  "Value yourself, value your peers. Nourish trust and genuine energy.",
  "Real people, not bots. Real work, not AI slop.",
] as const;

export const OATH_CTA = "I'm in";

/** After onboarding, before an admin lets the person in. */
export const PENDING_TITLE = "Awaiting verification";

export const PENDING_WELCOME = FAMILCY_WELCOME;

export const PENDING_BODY =
  "A real person will review your application before you're let in.";

export const PENDING_GLIMPSE = "A look at the people already here.";
