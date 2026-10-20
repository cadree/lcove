import assert from "node:assert/strict";
import test from "node:test";
import { decodeShareCard, encodeShareCard, splitShareMessage } from "./shareCard.ts";

const card = {
  kind: "post" as const,
  id: "p1",
  userId: "u1",
  title: "Ada",
  subtitle: "Golden hour",
  mediaUrl: "https://example.com/a.jpg",
  mediaType: "photo",
  href: "/profile/u1",
};

test("a share card round-trips and a note stays separate", () => {
  const encoded = encodeShareCard(card);
  assert.deepEqual(decodeShareCard(encoded), card);
  const split = splitShareMessage(`Look at this\n${encoded}`);
  assert.equal(split.note, "Look at this");
  assert.equal(split.card?.id, "p1");
});

test("a bad card is not treated as a card", () => {
  assert.equal(decodeShareCard("hello"), null);
  assert.equal(decodeShareCard("ether-card:{"), null);
  assert.equal(decodeShareCard('ether-card:{"kind":"post","id":"1","userId":"u","title":"A","href":"https://evil"}'), null);
  assert.equal(splitShareMessage("just a message").card, null);
  assert.equal(splitShareMessage("just a message").note, "just a message");
});
