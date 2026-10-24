export type ShareCardKind = "post" | "story" | "project" | "reel";

export interface ShareCard {
  kind: ShareCardKind;
  id: string;
  userId: string;
  title: string;
  subtitle?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  href: string;
}

const PREFIX = "ether-card:";

export function encodeShareCard(card: ShareCard) {
  return `${PREFIX}${JSON.stringify(card)}`;
}

export function decodeShareCard(line: string): ShareCard | null {
  if (!line.startsWith(PREFIX)) return null;
  try {
    const parsed = JSON.parse(line.slice(PREFIX.length)) as Partial<ShareCard>;
    if (!parsed || typeof parsed.id !== "string" || typeof parsed.href !== "string") return null;
    if (parsed.kind !== "post" && parsed.kind !== "story" && parsed.kind !== "project" && parsed.kind !== "reel") return null;
    if (typeof parsed.userId !== "string" || typeof parsed.title !== "string") return null;
    if (!parsed.href.startsWith("/")) return null;
    return {
      kind: parsed.kind,
      id: parsed.id,
      userId: parsed.userId,
      title: parsed.title,
      subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle : undefined,
      mediaUrl: typeof parsed.mediaUrl === "string" ? parsed.mediaUrl : null,
      mediaType: typeof parsed.mediaType === "string" ? parsed.mediaType : null,
      href: parsed.href,
    };
  } catch {
    return null;
  }
}

const SHARE_LABEL: Record<ShareCardKind, string> = {
  post: "Shared a post",
  reel: "Shared a reel",
  story: "Shared a story",
  project: "Shared a project",
};

/** Conversation-list line. Never returns the raw ether-card payload. */
export function messagePreview(content: string | null) {
  if (!content || !content.includes(PREFIX)) return null;
  const { card } = splitShareMessage(content);
  if (card?.kind === "reel") return SHARE_LABEL.reel;
  if (card) return SHARE_LABEL[card.kind];
  return SHARE_LABEL.post;
}

export function splitShareMessage(content: string | null) {
  if (!content) return { note: null as string | null, card: null as ShareCard | null };
  const lines = content.split("\n");
  const cardLine = lines.find((line) => line.startsWith(PREFIX));
  const note = lines.filter((line) => !line.startsWith(PREFIX)).join("\n").trim();
  return {
    note: note || null,
    card: cardLine ? decodeShareCard(cardLine) : null,
  };
}
