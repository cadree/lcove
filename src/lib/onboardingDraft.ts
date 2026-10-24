import { migrateOnboardingDraftStep } from "./signupOnboarding.ts";

export interface OnboardingDraftData {
  displayName: string;
  passions: string[];
  passionSeriousness: number;
  city: string;
  cityDisplay: string;
  cityKey: string;
  skills: string[];
  roles: string[];
  questionnaireResponses: Record<number, "A" | "B" | "C">;
}

export interface OnboardingDraft {
  step: number;
  data: OnboardingDraftData;
}

const DRAFT_VERSION = 2;

export function onboardingDraftKey(userId: string) {
  return `ether-onboarding-draft:${userId}`;
}

function isChoice(value: unknown): value is "A" | "B" | "C" {
  return value === "A" || value === "B" || value === "C";
}

export function readOnboardingDraft(storage: Storage, userId: string): OnboardingDraft | null {
  try {
    const raw = storage.getItem(onboardingDraftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft> & { version?: unknown };
    if (!parsed || typeof parsed.step !== "number" || !Number.isFinite(parsed.step)) return null;
    const data = parsed.data;
    if (!data || typeof data !== "object") return null;
    const responses: Record<number, "A" | "B" | "C"> = {};
    const source = data.questionnaireResponses ?? {};
    for (const [key, value] of Object.entries(source)) {
      const index = Number(key);
      if (Number.isInteger(index) && isChoice(value)) responses[index] = value;
    }
    return {
      step: migrateOnboardingDraftStep(
        parsed.step,
        typeof parsed.version === "number" ? parsed.version : undefined,
      ),
      data: {
        displayName: typeof data.displayName === "string" ? data.displayName : "",
        passions: Array.isArray(data.passions) ? data.passions.filter((item) => typeof item === "string") : [],
        passionSeriousness: typeof data.passionSeriousness === "number" ? data.passionSeriousness : 5,
        city: typeof data.city === "string" ? data.city : "",
        cityDisplay: typeof data.cityDisplay === "string" ? data.cityDisplay : "",
        cityKey: typeof data.cityKey === "string" ? data.cityKey : "",
        skills: Array.isArray(data.skills) ? data.skills.filter((item) => typeof item === "string") : [],
        roles: Array.isArray(data.roles) ? data.roles.filter((item) => typeof item === "string") : [],
        questionnaireResponses: responses,
      },
    };
  } catch {
    return null;
  }
}

export function writeOnboardingDraft(storage: Storage, userId: string, draft: OnboardingDraft) {
  storage.setItem(onboardingDraftKey(userId), JSON.stringify({ ...draft, version: DRAFT_VERSION }));
}

export function clearOnboardingDraft(storage: Storage, userId: string) {
  storage.removeItem(onboardingDraftKey(userId));
}
