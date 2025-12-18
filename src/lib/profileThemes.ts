// Profile Theme Presets and Configuration

export type ThemePreset = 'clean_modern' | 'retro_spacehey' | 'cyberpunk';

export interface ThemeConfig {
  id: ThemePreset;
  name: string;
  description: string;
  icon: string;
  // Typography
  fontFamily: string;
  headingFont: string;
  // Colors
  primaryAccent: string;
  secondaryAccent: string;
  cardBackground: string;
  textPrimary: string;
  textSecondary: string;
  // Effects
  defaultEffects: {
    grain: boolean;
    neonGlow: boolean;
    scanlines: boolean;
    holographic: boolean;
    motionGradient: boolean;
  };
  // Background defaults
  defaultBackground: {
    type: 'color' | 'gradient' | 'image';
    value: string;
    blur: number;
    opacity: number;
  };
  // Borders & shadows
  borderStyle: string;
  shadowStyle: string;
  cardStyle: string;
}

export const THEME_PRESETS: Record<ThemePreset, ThemeConfig> = {
  clean_modern: {
    id: 'clean_modern',
    name: 'Clean Modern',
    description: 'Minimal, elegant, and professional',
    icon: '✨',
    fontFamily: 'var(--font-sans)',
    headingFont: 'var(--font-display)',
    primaryAccent: 'hsl(var(--primary))',
    secondaryAccent: 'hsl(var(--accent))',
    cardBackground: 'hsl(var(--card))',
    textPrimary: 'hsl(var(--foreground))',
    textSecondary: 'hsl(var(--muted-foreground))',
    defaultEffects: {
      grain: false,
      neonGlow: false,
      scanlines: false,
      holographic: false,
      motionGradient: false,
    },
    defaultBackground: {
      type: 'gradient',
      value: 'from-primary/30 via-background to-accent/20',
      blur: 0,
      opacity: 1,
    },
    borderStyle: 'border border-border/50',
    shadowStyle: 'shadow-lg',
    cardStyle: 'glass-strong rounded-xl',
  },
  retro_spacehey: {
    id: 'retro_spacehey',
    name: 'Retro SpaceHey',
    description: 'Nostalgic MySpace-inspired vibes',
    icon: '🌟',
    fontFamily: "'Comic Sans MS', 'Chalkboard', cursive",
    headingFont: "'Impact', 'Haettenschweiler', sans-serif",
    primaryAccent: '#ff69b4',
    secondaryAccent: '#00ffff',
    cardBackground: 'rgba(0, 0, 0, 0.8)',
    textPrimary: '#ffffff',
    textSecondary: '#cccccc',
    defaultEffects: {
      grain: true,
      neonGlow: false,
      scanlines: true,
      holographic: false,
      motionGradient: false,
    },
    defaultBackground: {
      type: 'gradient',
      value: 'from-purple-900 via-pink-800 to-blue-900',
      blur: 0,
      opacity: 1,
    },
    borderStyle: 'border-2 border-pink-500',
    shadowStyle: 'shadow-[0_0_10px_rgba(255,105,180,0.5)]',
    cardStyle: 'bg-black/80 rounded-lg border-2 border-pink-500/50',
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Futuristic neon aesthetics',
    icon: '🤖',
    fontFamily: "'Orbitron', 'Rajdhani', sans-serif",
    headingFont: "'Orbitron', monospace",
    primaryAccent: '#00ff9f',
    secondaryAccent: '#ff00ff',
    cardBackground: 'rgba(0, 10, 20, 0.9)',
    textPrimary: '#00ff9f',
    textSecondary: '#88ffcc',
    defaultEffects: {
      grain: false,
      neonGlow: true,
      scanlines: false,
      holographic: true,
      motionGradient: true,
    },
    defaultBackground: {
      type: 'gradient',
      value: 'from-black via-slate-900 to-cyan-950',
      blur: 0,
      opacity: 1,
    },
    borderStyle: 'border border-cyan-500/50',
    shadowStyle: 'shadow-[0_0_20px_rgba(0,255,159,0.3)]',
    cardStyle: 'bg-black/90 rounded-none border border-cyan-500/30',
  },
};

export const APPROVED_FONTS = [
  { id: 'default', name: 'System Default', value: 'var(--font-sans)' },
  { id: 'display', name: 'Display', value: 'var(--font-display)' },
  { id: 'comic', name: 'Comic Sans', value: "'Comic Sans MS', cursive" },
  { id: 'impact', name: 'Impact', value: "'Impact', sans-serif" },
  { id: 'courier', name: 'Courier', value: "'Courier New', monospace" },
  { id: 'georgia', name: 'Georgia', value: "'Georgia', serif" },
  { id: 'trebuchet', name: 'Trebuchet', value: "'Trebuchet MS', sans-serif" },
  { id: 'verdana', name: 'Verdana', value: "'Verdana', sans-serif" },
  { id: 'palatino', name: 'Palatino', value: "'Palatino Linotype', serif" },
];

export const OVERLAY_TINTS = [
  { id: 'none', name: 'None', value: null },
  { id: 'dark', name: 'Dark', value: 'rgba(0,0,0,0.5)' },
  { id: 'light', name: 'Light', value: 'rgba(255,255,255,0.1)' },
  { id: 'pink', name: 'Pink', value: 'rgba(236,72,153,0.2)' },
  { id: 'cyan', name: 'Cyan', value: 'rgba(6,182,212,0.2)' },
  { id: 'purple', name: 'Purple', value: 'rgba(147,51,234,0.2)' },
  { id: 'amber', name: 'Amber', value: 'rgba(245,158,11,0.15)' },
  { id: 'green', name: 'Green', value: 'rgba(34,197,94,0.15)' },
];

export const PROFILE_SECTIONS = [
  { id: 'about', name: 'About', icon: 'User' },
  { id: 'music', name: 'Music', icon: 'Music' },
  { id: 'stats', name: 'Stats', icon: 'BarChart' },
  { id: 'links', name: 'Links', icon: 'Link' },
  { id: 'projects', name: 'Projects', icon: 'Briefcase' },
  { id: 'store', name: 'Store', icon: 'Store' },
  { id: 'events', name: 'Events', icon: 'Calendar' },
];

// Helper to get CSS variables for a theme
export const getThemeCSSVariables = (theme: ThemeConfig, customizations?: Partial<ThemeConfig>) => {
  const merged = { ...theme, ...customizations };
  return {
    '--profile-font': merged.fontFamily,
    '--profile-heading-font': merged.headingFont,
    '--profile-primary': merged.primaryAccent,
    '--profile-secondary': merged.secondaryAccent,
    '--profile-card-bg': merged.cardBackground,
    '--profile-text': merged.textPrimary,
    '--profile-text-muted': merged.textSecondary,
  } as React.CSSProperties;
};
