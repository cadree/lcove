import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("admin dashboard uses one document scroll surface on iPhone", async () => {
  const source = await readFile("src/pages/Admin.tsx", "utf8");
  const members = await readFile("src/components/admin/members/AdminMembersTab.tsx", "utf8");
  for (const file of [source, members]) {
    assert.equal(file.includes("<ScrollArea"), false, "Nested Radix scroll views trap mobile swipes");
    assert.equal(file.includes("</ScrollArea>"), false, "Nested Radix scroll views trap mobile swipes");
    assert.equal(file.includes("h-[500px]"), false, "User list must not have fixed height");
    assert.equal(file.includes("h-[400px]"), false, "Admin tab lists must not have fixed height");
    assert.equal(file.includes("h-[350px]"), false, "Message history must not have fixed height");
  }
  for (const tab of ["users", "pending", "messages", "flagged", "history"]) {
    assert.ok(source.includes(`<TabsContent value="${tab}"`), `Missing ${tab} tab`);
  }
  assert.ok(source.includes("<AdminMembersTab actions={memberActions} />"), "Users tab should use the paged member list");
  for (const action of ["setCreditDialog(", "setStatusDialog(", "setIndividualMessageDialog(", "setRemoveDialog(", "toggleAdminRole.mutate"]) {
    assert.ok(source.includes(action), `Missing admin action: ${action}`);
  }
});

test("member list stays light enough for thousands of people", async () => {
  const source = await readFile("src/pages/Admin.tsx", "utf8");
  const members = await readFile("src/components/admin/members/AdminMembersTab.tsx", "utf8");
  assert.ok(source.includes("useAdminUserData({ enabled: bulkCreditDialog })"), "The full member dump must not load with the page");
  assert.ok(members.includes("useAdminMemberPage("), "Rows come one page at a time from the server");
  assert.ok(members.includes('data-testid="bulk-bar"'), "Selecting people shows the bulk bar");
  assert.ok(members.includes("selectAllMatching"), "Admins can select everyone that matches a filter");
});

test("admin review shows applicant socials as tappable external links", async () => {
  const members = await readFile("src/components/admin/members/AdminMembersTab.tsx", "utf8");
  const onboarding = await readFile("src/pages/AdminOnboarding.tsx", "utf8");
  const links = await readFile("src/components/admin/ApplicantSocialLinks.tsx", "utf8");
  assert.ok(members.includes("<ApplicantSocialLinks"), "Member detail must render clickable social links");
  assert.ok(onboarding.includes("<ApplicantSocialLinks"), "Onboarding review must render clickable social links");
  assert.equal(members.includes("{key}:</span> {value}"), false, "Socials must not be plain text in the member sheet");
  assert.ok(links.includes("onExternalHttpUrlClick"), "Taps must use the shared external open path");
  assert.ok(links.includes('target="_blank"'), "Links keep a real href for web");
});

test("admin tabs scroll with the page, not inside fixed-height boxes", async () => {
  for (const path of [
    "src/components/admin/PartnerApplicationsTab.tsx",
    "src/components/admin/ContentModerationTab.tsx",
    "src/components/admin/ContentReportsTab.tsx",
  ]) {
    const file = await readFile(path, "utf8");
    assert.equal(file.includes("<ScrollArea"), false, `${path}: a nested scroll box takes the swipe, then the page jumps`);
    assert.doesNotMatch(file, /className="h-\[\d+px\]"/, `${path}: lists must not have a fixed pixel height`);
  }
});

test("admin stats placeholder is as tall as the stats", async () => {
  const stats = await readFile("src/components/admin/AdminStats.tsx", "utf8");
  assert.ok(stats.includes('className="h-[106px]"'), "Skeleton height must match a stat card so the page below does not shift");
});
