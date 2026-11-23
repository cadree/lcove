/**
 * What the New project form needs before Create works. The database only
 * requires a title; the pay type needs a budget (Paid) or a budget or role XP
 * (Hybrid) so collaborators know what they get. Everything else is optional.
 */
export type ProjectPayType = "paid" | "volunteer" | "hybrid";

interface PayInput {
  projectType: ProjectPayType;
  budget: number;
  roleCredits: number;
}

export function canCreateProject(input: PayInput & { title: string }): boolean {
  if (!input.title.trim()) return false;
  return createPayHint(input) === null;
}

/** Why Create is still off, in plain words, or null when pay is set. */
export function createPayHint({ projectType, budget, roleCredits }: PayInput): string | null {
  const hasBudget = Number.isFinite(budget) && budget > 0;
  if (projectType === "volunteer") return null;
  if (projectType === "paid") return hasBudget ? null : "Add the total budget to create a paid project.";
  return hasBudget || roleCredits > 0 ? null : "Add a total budget, or XP for a role under More details.";
}

export interface ProjectExtras {
  isPrivate: boolean;
  hideFromCalendar: boolean;
  listingType: "project" | "gig";
  outcomes: number;
  attachments: number;
  budgetRange: string;
  equipmentNeeded: string;
  locationSecured: boolean;
  venue: string;
  propsNeeded: string;
  sponsorshipNeeded: boolean;
  vendorsNeeded: boolean;
  startDate: string;
  endDate: string;
  milestoneDates: number;
  roles: number;
  allowCustomRoles: boolean;
  deliverables: number;
}

/** How many optional details are filled in, shown on the closed More details row. */
export function filledProjectExtras(extras: ProjectExtras): number {
  const filled = [
    extras.isPrivate,
    extras.hideFromCalendar,
    extras.listingType !== "project",
    extras.outcomes > 0,
    extras.attachments > 0,
    !!extras.budgetRange,
    !!extras.equipmentNeeded.trim(),
    extras.locationSecured,
    !!extras.venue.trim(),
    !!extras.propsNeeded.trim(),
    extras.sponsorshipNeeded,
    extras.vendorsNeeded,
    !!extras.startDate || !!extras.endDate,
    extras.milestoneDates > 0,
    extras.roles > 0,
    extras.allowCustomRoles,
    extras.deliverables > 0,
  ];
  return filled.filter(Boolean).length;
}
