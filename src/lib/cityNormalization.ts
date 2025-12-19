/**
 * City normalization utilities
 * Handles consistent formatting and deduplication of city names
 */

// State abbreviation mappings (lowercase to uppercase)
const STATE_ABBREVIATIONS: Record<string, string> = {
  al: 'AL', ak: 'AK', az: 'AZ', ar: 'AR', ca: 'CA', co: 'CO', ct: 'CT', de: 'DE',
  fl: 'FL', ga: 'GA', hi: 'HI', id: 'ID', il: 'IL', in: 'IN', ia: 'IA', ks: 'KS',
  ky: 'KY', la: 'LA', me: 'ME', md: 'MD', ma: 'MA', mi: 'MI', mn: 'MN', ms: 'MS',
  mo: 'MO', mt: 'MT', ne: 'NE', nv: 'NV', nh: 'NH', nj: 'NJ', nm: 'NM', ny: 'NY',
  nc: 'NC', nd: 'ND', oh: 'OH', ok: 'OK', or: 'OR', pa: 'PA', ri: 'RI', sc: 'SC',
  sd: 'SD', tn: 'TN', tx: 'TX', ut: 'UT', vt: 'VT', va: 'VA', wa: 'WA', wv: 'WV',
  wi: 'WI', wy: 'WY', dc: 'DC',
};

/**
 * Converts a string to Title Case
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalize state abbreviation (e.g., "nc" -> "NC")
 */
function normalizeStateAbbreviation(state: string): string {
  const lower = state.toLowerCase().trim();
  return STATE_ABBREVIATIONS[lower] || state.toUpperCase();
}

export interface NormalizedCity {
  /** Display value for UI (Title Case, proper state abbreviations) */
  city_display: string;
  /** Normalized key for comparison/deduplication (lowercase, no extra spaces) */
  city_key: string;
}

/**
 * Normalizes a city string into display and key values
 * 
 * Examples:
 * - "Charlotte" -> { city_display: "Charlotte", city_key: "charlotte" }
 * - "charlotte " -> { city_display: "Charlotte", city_key: "charlotte" }
 * - "Charlotte, Nc" -> { city_display: "Charlotte, NC", city_key: "charlotte, nc" }
 * - "  los  angeles  " -> { city_display: "Los Angeles", city_key: "los angeles" }
 */
export function normalizeCity(rawCity: string): NormalizedCity {
  if (!rawCity || typeof rawCity !== 'string') {
    return { city_display: '', city_key: '' };
  }

  // Trim and collapse multiple spaces to single space
  const cleaned = rawCity.trim().replace(/\s+/g, ' ');
  
  if (!cleaned) {
    return { city_display: '', city_key: '' };
  }

  // Check if there's a comma (city, state format)
  const commaIndex = cleaned.indexOf(',');
  
  let displayValue: string;
  
  if (commaIndex !== -1) {
    // Has state component
    const cityPart = cleaned.substring(0, commaIndex).trim();
    const statePart = cleaned.substring(commaIndex + 1).trim();
    
    const titleCaseCity = toTitleCase(cityPart);
    const normalizedState = normalizeStateAbbreviation(statePart);
    
    displayValue = `${titleCaseCity}, ${normalizedState}`;
  } else {
    // Just city name
    displayValue = toTitleCase(cleaned);
  }

  // Key is always lowercase for comparison
  const keyValue = displayValue.toLowerCase();

  return {
    city_display: displayValue,
    city_key: keyValue,
  };
}

/**
 * Computes a city key from a raw city string (for on-the-fly deduplication)
 * Use this when you need to group/dedupe cities without the full normalization
 */
export function computeCityKey(rawCity: string | null | undefined): string {
  if (!rawCity) return '';
  return rawCity.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Computes a display value from a raw city string
 * Use this for backwards compatibility with old data that doesn't have city_display
 */
export function computeCityDisplay(rawCity: string | null | undefined): string {
  if (!rawCity) return '';
  const { city_display } = normalizeCity(rawCity);
  return city_display;
}
