import { CITY_ROWS } from "../data/cities.ts";

const STATE_ABBREVIATIONS: Record<string, string> = {
  al: "AL", ak: "AK", az: "AZ", ar: "AR", ca: "CA", co: "CO", ct: "CT", de: "DE",
  fl: "FL", ga: "GA", hi: "HI", id: "ID", il: "IL", in: "IN", ia: "IA", ks: "KS",
  ky: "KY", la: "LA", me: "ME", md: "MD", ma: "MA", mi: "MI", mn: "MN", ms: "MS",
  mo: "MO", mt: "MT", ne: "NE", nv: "NV", nh: "NH", nj: "NJ", nm: "NM", ny: "NY",
  nc: "NC", nd: "ND", oh: "OH", ok: "OK", or: "OR", pa: "PA", ri: "RI", sc: "SC",
  sd: "SD", tn: "TN", tx: "TX", ut: "UT", vt: "VT", va: "VA", wa: "WA", wv: "WV",
  wi: "WI", wy: "WY", dc: "DC",
};

const STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA",
  michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX",
  utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

const COUNTRY_LABELS: Record<string, string> = {
  AE: "UAE", AR: "Argentina", AT: "Austria", AU: "Australia", BD: "Bangladesh",
  BE: "Belgium", BR: "Brazil", CA: "Canada", CH: "Switzerland", CL: "Chile",
  CN: "China", CO: "Colombia", CZ: "Czechia", DE: "Germany", DK: "Denmark",
  EG: "Egypt", ES: "Spain", ET: "Ethiopia", FR: "France", GB: "UK", GH: "Ghana",
  GR: "Greece", HK: "Hong Kong", HU: "Hungary", ID: "Indonesia", IE: "Ireland",
  IL: "Israel", IN: "India", IT: "Italy", JP: "Japan", KE: "Kenya", KR: "South Korea",
  MA: "Morocco", MX: "Mexico", MY: "Malaysia", NG: "Nigeria", NL: "Netherlands",
  NO: "Norway", NZ: "New Zealand", PE: "Peru", PH: "Philippines", PK: "Pakistan",
  PL: "Poland", PT: "Portugal", RO: "Romania", RU: "Russia", SA: "Saudi Arabia",
  SE: "Sweden", SG: "Singapore", TH: "Thailand", TR: "Turkey", TW: "Taiwan",
  UA: "Ukraine", US: "USA", VN: "Vietnam", ZA: "South Africa",
};

const COUNTRY_NAMES: Record<string, string> = {};
for (const [code, label] of Object.entries(COUNTRY_LABELS)) {
  COUNTRY_NAMES[label.toLowerCase()] = code;
}
COUNTRY_NAMES["united kingdom"] = "GB";
COUNTRY_NAMES["great britain"] = "GB";
COUNTRY_NAMES["uk"] = "GB";
COUNTRY_NAMES["united states"] = "US";
COUNTRY_NAMES["usa"] = "US";
COUNTRY_NAMES["south korea"] = "KR";
COUNTRY_NAMES["korea"] = "KR";

export interface CityRecord {
  name: string;
  region: string;
  country: string;
  population: number;
  nameKey: string;
  label: string;
  key: string;
}

export type CityConfidence = "exact" | "fuzzy" | "free";

export interface ResolvedCity {
  /** Cleaned text the person typed. Callers keep this when they did not pick a suggestion. */
  original: string;
  city_display: string;
  city_key: string;
  confidence: CityConfidence;
  suggestion: { label: string; key: string } | null;
}

const NAME_ALIASES: Record<string, string> = {
  "new york": "new york city",
  nyc: "new york city",
};

function nameKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function regionLabel(region: string, country: string): string {
  if (country === "US") return region;
  return COUNTRY_LABELS[country] || country;
}

function cityKey(name: string, region: string, country: string): string {
  const regionPart = country === "US" ? region : country;
  return regionPart ? `${nameKey(name)}|${regionPart.toLowerCase()}` : nameKey(name);
}

function cityLabel(name: string, region: string, country: string): string {
  const place = regionLabel(region, country);
  return place ? `${name}, ${place}` : name;
}

const CITIES: CityRecord[] = CITY_ROWS.map(([name, region, country, population]) => ({
  name,
  region,
  country,
  population,
  nameKey: nameKey(name),
  label: cityLabel(name, region, country),
  key: cityKey(name, region, country),
}));

const BY_NAME = new Map<string, CityRecord[]>();
const BY_INITIAL = new Map<string, CityRecord[]>();

for (const city of CITIES) {
  const named = BY_NAME.get(city.nameKey);
  if (named) named.push(city);
  else BY_NAME.set(city.nameKey, [city]);

  const initial = city.nameKey[0] || "";
  const bucket = BY_INITIAL.get(initial);
  if (bucket) bucket.push(city);
  else BY_INITIAL.set(initial, [city]);
}

for (const list of BY_NAME.values()) {
  list.sort((a, b) => b.population - a.population);
}

const STATE_NAME_KEYS = Object.keys(STATE_NAMES).sort((a, b) => b.length - a.length);

function knownRegion(token: string): string | null {
  const lower = token.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (!lower) return null;
  if (STATE_ABBREVIATIONS[lower]) return STATE_ABBREVIATIONS[lower];
  if (STATE_NAMES[lower]) return STATE_NAMES[lower];
  if (COUNTRY_NAMES[lower]) return COUNTRY_NAMES[lower];
  if (/^[a-z]{2}$/.test(lower) && COUNTRY_LABELS[lower.toUpperCase()]) return lower.toUpperCase();
  return null;
}

function peelRegion(cleaned: string): { name: string; region: string | null } {
  const comma = cleaned.indexOf(",");
  if (comma !== -1) {
    const name = cleaned.slice(0, comma).trim();
    const region = knownRegion(cleaned.slice(comma + 1));
    if (name && region) return { name, region };
    return { name: cleaned, region: null };
  }

  const lower = cleaned.toLowerCase();
  for (const stateName of STATE_NAME_KEYS) {
    const suffix = ` ${stateName}`;
    if (lower.endsWith(suffix)) {
      const name = cleaned.slice(0, cleaned.length - suffix.length).trim();
      if (name) return { name, region: STATE_NAMES[stateName] };
    }
  }

  const parts = cleaned.split(" ");
  if (parts.length >= 2) {
    const region = knownRegion(parts[parts.length - 1]);
    const stateAbbrev = STATE_ABBREVIATIONS[parts[parts.length - 1].toLowerCase().replace(/\./g, "")];
    if (region && stateAbbrev) {
      return { name: parts.slice(0, -1).join(" "), region: stateAbbrev };
    }
  }

  return { name: cleaned, region: null };
}

function inRegion(city: CityRecord, region: string): boolean {
  if (city.country === "US") return city.region === region;
  return city.country === region;
}

/** Pick a city when one place clearly dominates, otherwise leave the choice open. */
function dominant(candidates: CityRecord[]): CityRecord | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const [first, second] = [...candidates].sort((a, b) => b.population - a.population);
  if (first.population >= second.population * 3) return first;
  return null;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const gap = Math.abs(a.length - b.length);
  if (gap > 2) return 99;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > 2) return 99;
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function maxDistance(length: number): number {
  if (length >= 8) return 2;
  if (length >= 5) return 1;
  return 0;
}

function fromRecord(original: string, city: CityRecord, confidence: CityConfidence): ResolvedCity {
  return {
    original,
    city_display: city.label,
    city_key: city.key,
    confidence,
    suggestion: { label: city.label, key: city.key },
  };
}

function freeText(original: string, name: string, region: string | null): ResolvedCity {
  const displayName = titleCase(name);
  const display = region
    ? `${displayName}, ${region.length === 2 ? region.toUpperCase() : titleCase(region)}`
    : displayName;
  const key = region ? `${nameKey(name)}|${region.toLowerCase()}` : nameKey(name);
  return {
    original,
    city_display: display,
    city_key: key,
    confidence: "free",
    suggestion: null,
  };
}

function fuzzyMatch(typedName: string, region: string | null): CityRecord | null {
  const key = nameKey(typedName);
  const limit = maxDistance(key.length);
  if (!key || limit === 0) return null;
  const pool = BY_INITIAL.get(key[0]) || [];
  let bestDist = limit + 1;
  let best: CityRecord[] = [];

  for (const city of pool) {
    if (Math.abs(city.nameKey.length - key.length) > limit) continue;
    if (region && !inRegion(city, region)) continue;
    if (city.nameKey.startsWith(key) && key.length < city.nameKey.length) continue;
    const dist = levenshtein(key, city.nameKey);
    if (dist === 0 || dist > limit) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = [city];
    } else if (dist === bestDist) {
      best.push(city);
    }
  }

  if (best.length === 0) return null;
  if (region) {
    const regional = best.filter((city) => inRegion(city, region));
    if (regional.length === 1) return regional[0];
    return dominant(regional);
  }
  if (best.length === 1) return best[0];
  return dominant(best);
}

/**
 * Match a typed city to the bundled list.
 * A picked suggestion uses the city's label. Free text stays valid.
 * High-confidence typos fold into the matched city key.
 */
export function resolveCity(raw: string | null | undefined): ResolvedCity {
  const original = (raw || "").trim().replace(/\s+/g, " ");
  if (!original) {
    return { original: "", city_display: "", city_key: "", confidence: "free", suggestion: null };
  }

  const { name, region } = peelRegion(original);
  const key = NAME_ALIASES[nameKey(name)] || nameKey(name);
  const exact = BY_NAME.get(key) || [];

  if (region) {
    const regional = exact.filter((city) => inRegion(city, region));
    if (regional.length > 0) return fromRecord(original, regional[0], "exact");
    const fuzzy = fuzzyMatch(name, region);
    if (fuzzy) return fromRecord(original, fuzzy, "fuzzy");
    return freeText(original, name, region);
  }

  if (exact.length > 0) {
    const chosen = dominant(exact);
    if (chosen) return fromRecord(original, chosen, "exact");
    return freeText(original, name, null);
  }

  const fuzzy = fuzzyMatch(name, null);
  if (fuzzy) return fromRecord(original, fuzzy, "fuzzy");
  return freeText(original, name, null);
}

/** Autocomplete suggestions. The first item is the default pick. */
export function suggestCities(raw: string, limit = 8): CityRecord[] {
  const original = (raw || "").trim().replace(/\s+/g, " ");
  if (original.length < 2) return [];
  const { name, region } = peelRegion(original);
  const key = nameKey(name);
  if (key.length < 2) return [];
  const aliased = NAME_ALIASES[key];

  const prefix: CityRecord[] = [];
  const fuzzy: CityRecord[] = [];
  const seen = new Set<string>();

  const consider = (city: CityRecord, bucket: CityRecord[]) => {
    if (seen.has(city.key)) return;
    if (region && !inRegion(city, region)) return;
    seen.add(city.key);
    bucket.push(city);
  };

  if (aliased) {
    for (const city of BY_NAME.get(aliased) || []) consider(city, prefix);
  }
  for (const city of CITIES) {
    if (city.nameKey.startsWith(key) || (aliased && city.nameKey.startsWith(aliased))) consider(city, prefix);
  }

  if (prefix.length < limit) {
    const match = fuzzyMatch(name, region);
    if (match) consider(match, fuzzy);
    const pool = BY_INITIAL.get(key[0]) || [];
    const limitDist = maxDistance(key.length);
    if (limitDist > 0) {
      for (const city of pool) {
        if (fuzzy.length >= limit) break;
        if (Math.abs(city.nameKey.length - key.length) > limitDist) continue;
        const dist = levenshtein(key, city.nameKey);
        if (dist > 0 && dist <= limitDist) consider(city, fuzzy);
      }
    }
  }

  const rank = (a: CityRecord, b: CityRecord) => {
    const aRegion = region && inRegion(a, region) ? 1 : 0;
    const bRegion = region && inRegion(b, region) ? 1 : 0;
    if (aRegion !== bRegion) return bRegion - aRegion;
    return b.population - a.population;
  };

  return [...prefix.sort(rank), ...fuzzy.sort(rank)].slice(0, limit);
}

export function cityGroupKey(raw: string | null | undefined): string {
  return resolveCity(raw).city_key;
}
