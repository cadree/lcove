/** Typed help Novi can show. No generated answers. */

export interface GuideEntry {
  id: string;
  question: string;
  answer: string;
  href: string;
  hrefLabel: string;
  keywords: readonly string[];
}

export const NOVI_GUIDE: readonly GuideEntry[] = [
  {
    id: "post",
    question: "How do I post?",
    answer:
      "Open Create and choose Post, or use the box at the top of the feed. Add text or a photo or video, then share it. A post with text or media writes 10 XP. An empty post does not.",
    href: "/feed?action=create-post",
    hrefLabel: "Open the feed",
    keywords: ["post", "posting", "photo", "video", "caption", "upload", "feed", "composer"],
  },
  {
    id: "live",
    question: "How do I go live?",
    answer:
      "Open Create and choose Go live, or open Live and start a stream. Add a title, then go live from that stream.",
    href: "/live?action=create",
    hrefLabel: "Open Live",
    keywords: ["live", "stream", "broadcast"],
  },
  {
    id: "xp",
    question: "How do I earn XP?",
    answer:
      "XP is a private level. A post with text or media is 10 XP. An editor seat on someone else's board, or an accepted project application, is 15 XP. RSVP going to someone else's event is 10 XP. Completing a project is 25 XP for the creator and each accepted collaborator. Finishing your profile, adding someone from the directory, opening the Book, and opening Studio are 10 XP each. Decode today on the quest log for up to 5 XP. A UTC day caps at 40 XP. Likes, comments, and follows do not write XP. XP is not credits and cannot be paid out.",
    href: "/quests",
    hrefLabel: "Open quests",
    keywords: ["xp", "level", "quest", "earn", "points"],
  },
  {
    id: "share",
    question: "How do I share or repost?",
    answer:
      "Tap Share on a feed item to copy its link, send it, add it to your story, or repost a photo or video. Sharing a link does not write XP.",
    href: "/feed",
    hrefLabel: "Open the feed",
    keywords: ["share", "repost", "link", "copy"],
  },
  {
    id: "store",
    question: "How do I use Studio and Store?",
    answer:
      "Open Store. Products, Services, and Studios are separate tabs. Buy with credits. To sell, create a store, then add an item. Studio rentals are booked from the Studios tab.",
    href: "/store",
    hrefLabel: "Open Store",
    keywords: ["studio", "store", "shop", "rental", "product", "service", "buy", "sell", "booking"],
  },
  {
    id: "paid",
    question: "How do I get paid?",
    answer:
      "Credits are money. XP is not. Genesis credits cannot be withdrawn. Earned credits can be paid out from Wallet after you add a payout method.",
    href: "/wallet",
    hrefLabel: "Open Wallet",
    keywords: ["paid", "pay", "payout", "wallet", "withdraw", "credits", "money"],
  },
  {
    id: "report",
    question: "How do I report someone?",
    answer:
      "Open their profile, post, comment, message, or project and tap Report. Choose a reason. Reports go to admins. You can Block someone on their profile or in a message. AI-generated people, fake profiles, and AI-made work presented as human-made can be reported.",
    href: "/guidelines",
    hrefLabel: "Community guidelines",
    keywords: ["report", "block", "abuse", "harass", "spam", "fake", "safety"],
  },
  {
    id: "help",
    question: "Where is help?",
    answer: "Community guidelines cover what is allowed, how to report, and how blocking works.",
    href: "/guidelines",
    hrefLabel: "Open help",
    keywords: ["help", "guidelines", "rules", "support"],
  },
];

export const NOVI_GUIDE_FALLBACK = {
  message: "Nothing matches. Open help, or report someone from their profile.",
  helpHref: "/guidelines",
  helpLabel: "Help",
  reportHref: "/directory",
  reportLabel: "Report",
} as const;
