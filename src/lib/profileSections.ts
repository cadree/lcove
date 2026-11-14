export interface LayoutSection {
  id: string;
  visible: boolean;
  order: number;
}

/** Dialog section ids mapped onto the sections the profile actually renders. */
const CUSTOM_TO_LAYOUT: Record<string, string[]> = {
  about: ["about"],
  music: ["music"],
  stats: ["stats"],
  links: ["quick_links"],
  projects: ["portfolio"],
  store: ["store"],
  events: ["calendar", "events_dashboard"],
};

export interface ProfileSectionPrefs {
  section_order?: string[] | null;
  show_top_friends?: boolean | null;
}

/** Written by the old dialog for every save, including a font-only save. */
export const LEGACY_SECTION_ORDER = ["about", "music", "stats", "links"];

const LAYOUT_TO_CUSTOM: Record<string, string> = {
  about: "about",
  music: "music",
  stats: "stats",
  quick_links: "links",
  portfolio: "projects",
  store: "store",
  calendar: "events",
  events_dashboard: "events",
};

export function isLegacySectionOrder(order: string[] | null | undefined): boolean {
  if (!order || order.length !== LEGACY_SECTION_ORDER.length) return false;
  return LEGACY_SECTION_ORDER.every((id, index) => order[index] === id);
}

/** What the profile already shows, so an untouched save can persist "no override". */
export function sectionStateFromLayout(layout: LayoutSection[]): {
  sectionOrder: string[];
  showTopFriends: boolean;
} {
  const sectionOrder: string[] = [];
  let showTopFriends = true;
  let sawFriends = false;
  for (const section of [...layout].sort((a, b) => a.order - b.order)) {
    if (section.id === "friends") {
      sawFriends = true;
      showTopFriends = section.visible;
      continue;
    }
    if (!section.visible) continue;
    const customId = LAYOUT_TO_CUSTOM[section.id];
    if (customId && !sectionOrder.includes(customId)) sectionOrder.push(customId);
  }
  if (!sawFriends) showTopFriends = true;
  return { sectionOrder, showTopFriends };
}

export function sameSectionSelection(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(a);
  return b.every((id) => ids.has(id));
}

/** Null when the stored value is absent or the old implicit default. */
export function explicitSectionOrder(prefs: ProfileSectionPrefs | null | undefined): string[] | null {
  const order = prefs?.section_order;
  if (!Array.isArray(order) || isLegacySectionOrder(order)) return null;
  return order;
}

export function explicitShowTopFriends(prefs: ProfileSectionPrefs | null | undefined): boolean | null {
  if (!prefs || typeof prefs.show_top_friends !== "boolean") return null;
  if (isLegacySectionOrder(prefs.section_order) && prefs.show_top_friends === false) return null;
  return prefs.show_top_friends;
}

export function sectionFieldsForSave(
  state: { sectionOrder: string[]; showTopFriends: boolean },
  layout: LayoutSection[],
): { section_order: string[] | null; show_top_friends: boolean | null } {
  const derived = sectionStateFromLayout(layout);
  return {
    section_order: sameSectionSelection(state.sectionOrder, derived.sectionOrder) ? null : state.sectionOrder,
    show_top_friends: state.showTopFriends === derived.showTopFriends ? null : state.showTopFriends,
  };
}

export function applyProfileCustomization<T extends LayoutSection>(
  layout: T[],
  customization: ProfileSectionPrefs | null | undefined,
): T[] {
  const order = explicitSectionOrder(customization);
  const showTopFriends = explicitShowTopFriends(customization);
  if (!order && showTopFriends === null) return layout;

  let next = layout.map((section) => ({ ...section }));

  if (order) {
    const controlled = new Set(Object.values(CUSTOM_TO_LAYOUT).flat());
    const visibleIds = new Set(order.flatMap((id) => CUSTOM_TO_LAYOUT[id] ?? []));
    next = next.map((section) => {
      if (!controlled.has(section.id)) return section;
      return { ...section, visible: visibleIds.has(section.id) };
    });
  }

  if (showTopFriends !== null) {
    next = next.map((section) =>
      section.id === "friends" ? { ...section, visible: showTopFriends } : section,
    );
  }

  return next;
}

/** Hex color to "H S% L%" channels for hsl(var(--primary)). */
export function hexToHslChannels(hex: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        hue = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      default:
        hue = (r - g) / delta + 4;
    }
    hue /= 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}
