import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("admin dashboard uses one document scroll surface on iPhone", async () => {
  const source = await readFile("src/pages/Admin.tsx", "utf8");
  assert.equal(source.includes("<ScrollArea"), false, "Nested Radix scroll views trap mobile swipes");
  assert.equal(source.includes("</ScrollArea>"), false, "Nested Radix scroll views trap mobile swipes");
  assert.equal(source.includes("h-[500px]"), false, "User list must not have fixed height");
  assert.equal(source.includes('h-[400px]'), false, "Admin tab lists must not have fixed height");
  assert.equal(source.includes('h-[350px]'), false, "Message history must not have fixed height");
  assert.ok(source.includes('className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"'),
    "User cards should stack content and action buttons on narrow screens");
  assert.ok(source.includes('className="grid grid-cols-2 gap-2 sm:flex sm:flex-col"'),
    "Action controls should fit mobile without crushing user details");
  for (const tab of ["users","pending","messages","flagged","history"]) {
    assert.ok(source.includes(`<TabsContent value="${tab}"`), `Missing ${tab} tab`);
  }
  for (const action of ["setDetailDialog(user)", "setCreditDialog(", "setStatusDialog(", "setIndividualMessageDialog(", "setRemoveDialog(", "toggleAdminRole.mutate"]) {
    assert.ok(source.includes(action), `Missing admin action: ${action}`);
  }
});
