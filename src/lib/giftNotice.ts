const GIFT_NAMES: Record<string, string> = {
  rose: "Rose",
  star: "Star",
  crown: "Crown",
};

/** What every viewer can see. The gift price stays off this line. */
export function giftNoticeLabel(senderName: string | null | undefined, gift: string): string {
  const name = senderName?.trim() || "Someone";
  const item = GIFT_NAMES[gift] || gift.trim() || "gift";
  return `${name} sent a ${item}`;
}
