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
