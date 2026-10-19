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

export function applyProfileCustomization<T extends LayoutSection>(
  layout: T[],
  customization: ProfileSectionPrefs | null | undefined,
): T[] {
  if (!customization) return layout;
  let next = layout.map((section) => ({ ...section }));

  if (Array.isArray(customization.section_order)) {
    const controlled = new Set(Object.values(CUSTOM_TO_LAYOUT).flat());
    const visibleIds = new Set(
      customization.section_order.flatMap((id) => CUSTOM_TO_LAYOUT[id] ?? []),
    );
    const orderIndex = new Map<string, number>();
    customization.section_order.forEach((id, index) => {
      for (const layoutId of CUSTOM_TO_LAYOUT[id] ?? []) orderIndex.set(layoutId, index);
    });
    next = next.map((section) => {
      if (!controlled.has(section.id)) return section;
      return {
        ...section,
        visible: visibleIds.has(section.id),
        order: orderIndex.get(section.id) ?? section.order,
      };
    });
  }

  if (typeof customization.show_top_friends === "boolean") {
    next = next.map((section) =>
      section.id === "friends" ? { ...section, visible: customization.show_top_friends as boolean } : section,
    );
  }

  return next.sort((a, b) => a.order - b.order);
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
