import assert from "node:assert/strict";
import test from "node:test";
import { clearOnboardingDraft, readOnboardingDraft, writeOnboardingDraft } from "./onboardingDraft.ts";

function memoryStorage(): Storage {
  const bag = new Map<string, string>();
  return {
    get length() {
      return bag.size;
    },
    clear: () => bag.clear(),
    getItem: (key: string) => bag.get(key) ?? null,
    key: (index: number) => [...bag.keys()][index] ?? null,
    removeItem: (key: string) => bag.delete(key),
    setItem: (key: string, value: string) => bag.set(key, value),
  };
}

const sample = {
  step: 3,
  data: {
    displayName: "Ada",
    memberOf: "",
    passions: ["film"],
    passionSeriousness: 7,
    city: "Charlotte",
    cityDisplay: "Charlotte, NC",
    cityKey: "charlotte-nc",
    skills: [],
    roles: ["Director"],
    questionnaireResponses: { 6: "A" as const },
  },
};

test("a draft round-trips for the same user", () => {
  const storage = memoryStorage();
  writeOnboardingDraft(storage, "user-1", sample);
  assert.deepEqual(readOnboardingDraft(storage, "user-1"), sample);
  assert.equal(readOnboardingDraft(storage, "user-2"), null);
});

test("an old draft skips the tools step that signup no longer asks", () => {
  const storage = memoryStorage();
  storage.setItem(
    "ether-onboarding-draft:user-1",
    JSON.stringify({ ...sample, step: 4 }),
  );
  assert.equal(readOnboardingDraft(storage, "user-1")?.step, 3);
});

test("a draft without member of reads as empty", () => {
  const storage = memoryStorage();
  const { memberOf, ...data } = sample.data;
  void memberOf;
  storage.setItem(
    "ether-onboarding-draft:user-1",
    JSON.stringify({ step: 1, version: 2, data }),
  );
  assert.equal(readOnboardingDraft(storage, "user-1")?.data.memberOf, "");
});

test("a broken draft is ignored and completion clears it", () => {
  const storage = memoryStorage();
  storage.setItem("ether-onboarding-draft:user-1", "{");
  assert.equal(readOnboardingDraft(storage, "user-1"), null);
  writeOnboardingDraft(storage, "user-1", sample);
  clearOnboardingDraft(storage, "user-1");
  assert.equal(readOnboardingDraft(storage, "user-1"), null);
});
