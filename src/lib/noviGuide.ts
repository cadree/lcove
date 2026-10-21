import { NOVI_GUIDE, type GuideEntry } from "../content/noviGuide.ts";

const STOP = new Set([
  "a",
  "an",
  "the",
  "to",
  "how",
  "do",
  "i",
  "my",
  "of",
  "or",
  "and",
  "in",
  "on",
  "is",
  "it",
  "for",
  "me",
  "can",
  "what",
  "where",
  "when",
  "with",
  "you",
  "your",
  "get",
]);

export function guideTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP.has(token));
}

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreEntry(entry: GuideEntry, tokens: string[]): number {
  const question = words(entry.question);
  const answer = words(entry.answer);
  const keywords = entry.keywords.map((word) => word.toLowerCase());
  let score = 0;
  for (const token of tokens) {
    if (keywords.includes(token)) score += 5;
    else if (question.includes(token)) score += 3;
    else if (answer.includes(token)) score += 1;
  }
  return score;
}

/** Keyword match over the typed guide. Empty query returns every entry. */
export function searchGuide(query: string, entries: readonly GuideEntry[] = NOVI_GUIDE): GuideEntry[] {
  const tokens = guideTokens(query);
  if (tokens.length === 0) return [...entries];
  return entries
    .map((entry, index) => ({ entry, index, score: scoreEntry(entry, tokens) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.entry);
}
