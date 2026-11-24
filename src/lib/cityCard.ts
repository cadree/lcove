/**
 * Global view city cards: a name card per city with a member count. The colors come from
 * the city key, so a city always looks the same and no outside photo is needed.
 */
export function cardTone(key: string): { from: string; to: string } {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const hue = (h >>> 0) % 360;
  // Deep, readable tones that sit well on the dark globe; the second hue is a near neighbor.
  return { from: `hsl(${hue} 55% 42%)`, to: `hsl(${(hue + 38) % 360} 60% 22%)` };
}

/** The city part of a label, shortened so it fits a small card: "Charlotte, NC" -> "Charlotte". */
export function cardName(label: string, max = 10): string {
  const city = label.split(",")[0].trim();
  return city.length <= max ? city : `${city.slice(0, max - 1).trimEnd()}…`;
}

export function memberCount(n: number): string {
  return n > 99 ? "99+" : String(n);
}
