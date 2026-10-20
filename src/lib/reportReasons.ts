export const REPORT_TARGET_TYPES = ["post", "profile", "message", "comment", "project", "stream_message"] as const;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  "Harassment or abuse",
  "Spam",
  "Hate or violence",
  "Sexual content",
  "Scam or fraud",
  "Fake or AI-generated person",
  "Fully AI-generated scene passed off as real work",
  "AI slop / spam promotion",
  "Plagiarized or stolen work",
  "Other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "actioned", "dismissed"] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];
