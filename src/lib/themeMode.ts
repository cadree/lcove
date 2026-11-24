export type ThemeChoice = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "ether-theme";

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === "dark") return "dark";
  if (choice === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

export function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === "system" || value === "dark" || value === "light";
}
