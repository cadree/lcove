/** Credits on finished work: a completed project's team, or people the author credited on a post. */
export type CreditStatus = "pending" | "accepted" | "hidden";

export interface WorkCredit {
  id: string;
  role: string;
  status: CreditStatus;
  created_at: string;
  source: "project" | "post";
  project_id: string | null;
  post_id: string | null;
  title: string;
  cover: string | null;
  sort_at: string;
  credited_by: string;
  credited_by_name: string | null;
}

export interface PostCredit {
  id: string;
  user_id: string;
  role: string;
  status: CreditStatus;
  name: string | null;
  avatar_url: string | null;
}

export const CREDIT_ROLE_MAX = 60;

/** The role as the server stores it: single spaces, trimmed. */
export function cleanCreditRole(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function creditRoleError(raw: string): string | null {
  const role = cleanCreditRole(raw);
  if (!role) return "Add their role";
  if (role.length > CREDIT_ROLE_MAX) return `Keep the role to ${CREDIT_ROLE_MAX} characters`;
  return null;
}

/**
 * What a profile shows. Visitors only ever receive accepted credits (RLS);
 * the owner also gets pending ones to answer and hidden ones to restore.
 */
export function groupCredits(credits: WorkCredit[], isOwner: boolean) {
  const shown = credits.filter((c) => c.status === "accepted");
  if (!isOwner) return { pending: [], shown, hidden: [] };
  return {
    pending: credits.filter((c) => c.status === "pending"),
    shown,
    hidden: credits.filter((c) => c.status === "hidden"),
  };
}

/** Where a credit opens: the project page, or the post on its author's profile. */
export function creditHref(credit: Pick<WorkCredit, "source" | "project_id" | "post_id" | "credited_by">): string | null {
  if (credit.source === "project" && credit.project_id) return `/project/${credit.project_id}`;
  if (credit.source === "post" && credit.post_id) return `/profile/${credit.credited_by}?post=${credit.post_id}`;
  return null;
}

/** "Credited by Cadre" for post credits; projects say whose project it was only when it isn't the person's own. */
export function creditByline(credit: Pick<WorkCredit, "source" | "credited_by_name" | "credited_by">, profileUserId: string): string | null {
  if (credit.credited_by === profileUserId) return null;
  const who = credit.credited_by_name?.trim() || "a member";
  return credit.source === "post" ? `Post by ${who}` : `Project by ${who}`;
}

/** Accepted credits on a post, for its caption: "With Rezza (Stylist), Theo (Light)". */
export function postCreditLine(credits: PostCredit[]): string | null {
  const shown = credits.filter((c) => c.status === "accepted" && c.name);
  if (!shown.length) return null;
  return `With ${shown.map((c) => `${c.name} (${c.role})`).join(", ")}`;
}
