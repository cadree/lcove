import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeLike, retractFlaggedImage, type FlaggedImageDb } from "./nsfwRetract.ts";

type Call = { op: string; table: string; column?: string; pattern?: string; values?: unknown; id?: string };

function fakeDb(rows: Record<string, Array<Record<string, unknown>>>): { client: FlaggedImageDb; calls: Call[] } {
  const calls: Call[] = [];
  const client: FlaggedImageDb = {
    from(table) {
      return {
        delete: () => ({
          ilike: (column, pattern) => ({
            select: async () => {
              calls.push({ op: "delete", table, column, pattern });
              const matched = (rows[table] ?? []).filter((row) => String(row[column] ?? "").includes("user/photo.jpg"));
              rows[table] = (rows[table] ?? []).filter((row) => !matched.includes(row));
              return { data: matched.map((row) => ({ id: String(row.id) })), error: null };
            },
            eq: async () => ({ data: [], error: null }),
          }),
        }),
        update: (values) => ({
          ilike: (column, pattern) => ({
            select: async () => {
              calls.push({ op: "clear", table, column, pattern, values });
              const matched = (rows[table] ?? []).filter((row) => String(row[column] ?? "").includes("user/photo.jpg"));
              for (const row of matched) row[column] = null;
              return { data: matched.map((row) => ({ id: String(row.id) })), error: null };
            },
            eq: async () => ({ data: [], error: null }),
          }),
          eq: async (column, id) => {
            calls.push({ op: "update", table, column, id, values });
            const row = (rows[table] ?? []).find((item) => String(item[column]) === id);
            if (row) Object.assign(row, values);
            return { data: row ? [{ id }] : [], error: null };
          },
        }),
        select: () => ({
          contains: async (column) => {
            calls.push({ op: "contains", table, column });
            const matched = (rows[table] ?? []).filter((row) => {
              const list = row[column];
              return Array.isArray(list) && list.some((url) => String(url).includes("user/photo.jpg"));
            });
            return { data: matched, error: null };
          },
        }),
      };
    },
  };
  return { client, calls };
}

describe("retractFlaggedImage", () => {
  it("escapes like wildcards in the storage path", () => {
    assert.equal(escapeLike("user_1/100%.jpg"), "user\\_1/100\\%.jpg");
  });

  it("deletes a post, clears an avatar, and strips a store gallery", async () => {
    const rows = {
      posts: [{ id: "post-1", media_url: "https://cdn.test/media/user/photo.jpg" }],
      profiles: [{ id: "user-1", avatar_url: "https://cdn.test/media/user/photo.jpg" }],
      store_items: [{ id: "item-1", images: ["https://cdn.test/media/user/photo.jpg", "https://cdn.test/other.jpg"] }],
    };
    const { client, calls } = fakeDb(rows);
    const cleared = await retractFlaggedImage(
      client,
      "https://cdn.test/media/user/photo.jpg",
      "user/photo.jpg",
      [0],
      0,
    );
    assert.equal(cleared, 3);
    assert.equal(rows.posts.length, 0);
    assert.equal(rows.profiles[0].avatar_url, null);
    assert.deepEqual(rows.store_items[0].images, ["https://cdn.test/other.jpg"]);
    assert.equal(calls.some((call) => call.op === "delete" && call.table === "posts"), true);
    assert.match(String(calls.find((call) => call.table === "posts")?.pattern), /user\/photo\.jpg/);
  });

  it("keeps looking when the post is inserted after the upload returns", async () => {
    const rows: Record<string, Array<Record<string, unknown>>> = { posts: [] };
    const { client } = fakeDb(rows);
    const pending = retractFlaggedImage(client, "https://cdn.test/media/user/photo.jpg", "user/photo.jpg", [0, 20], 0);
    setTimeout(() => {
      rows.posts.push({ id: "post-2", media_url: "https://cdn.test/media/user/photo.jpg" });
    }, 10);
    const cleared = await pending;
    assert.equal(cleared, 1);
    assert.equal(rows.posts.length, 0);
  });
});
