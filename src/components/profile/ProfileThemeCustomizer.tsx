import { useState } from "react";
import { 
  Sparkles, 
  Palette, 
  Image, 
  Wand2, 
  LayoutGrid, 
  RotateCcw,
  Check,
  Music,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  THEME_PRESETS, 
  APPROVED_FONTS, 
  OVERLAY_TINTS,
  PROFILE_SECTIONS,
  ThemePreset,
} from "@/lib/profileThemes";
import { cn } from "@/lib/utils";

export interface CustomizationState {
  themePreset: ThemePreset;
  backgroundType: 'color' | 'gradient' | 'image';
  backgroundValue: string;
  backgroundOpacity: number;
  backgroundBlur: number;
  overlayTint: string | null;
  overlayOpacity: number;
  effectGrain: boolean;
  effectNeonGlow: boolean;
  effectScanlines: boolean;
  effectHolographic: boolean;
  effectMotionGradient: boolean;
  customFont: string | null;
  accentColorOverride: string | null;
  sectionOrder: string[];
  showTopFriends: boolean;
  musicVisualizerEnabled: boolean;
}

interface ProfileThemeCustomizerProps {
  state: CustomizationState;
  onChange: (state: Partial<CustomizationState>) => void;
  onReset: () => void;
  onPreview: () => void;
}

type TabId = 'themes' | 'background' | 'effects' | 'style' | 'layout';

const TABS: { id: TabId; icon: typeof Sparkles; label: string }[] = [
  { id: 'themes', icon: Sparkles, label: 'Themes' },
  { id: 'background', icon: Image, label: 'Background' },
  { id: 'effects', icon: Wand2, label: 'Effects' },
  { id: 'style', icon: Palette, label: 'Style' },
  { id: 'layout', icon: LayoutGrid, label: 'Layout' },
];

const PRESET_GRADIENTS = [
  { name: 'Default', value: 'from-primary/30 via-background to-accent/20' },
  { name: 'Sunset', value: 'from-orange-500/40 via-pink-500/30 to-purple-600/40' },
  { name: 'Ocean', value: 'from-blue-600/40 via-cyan-500/30 to-teal-500/40' },
  { name: 'Forest', value: 'from-green-700/40 via-emerald-600/30 to-lime-500/30' },
  { name: 'Galaxy', value: 'from-purple-900 via-violet-800 to-indigo-900' },
  { name: 'Midnight', value: 'from-slate-900 via-zinc-800 to-neutral-900' },
  { name: 'Neon', value: 'from-pink-600/50 via-purple-600/50 to-cyan-500/50' },
  { name: 'Retro', value: 'from-pink-500/40 via-fuchsia-600/40 to-violet-600/40' },
];

const PRESET_COLORS = [
  { name: 'Transparent', value: 'bg-transparent' },
  { name: 'Dark', value: 'bg-zinc-950' },
  { name: 'Charcoal', value: 'bg-neutral-900' },
  { name: 'Navy', value: 'bg-slate-900' },
  { name: 'Wine', value: 'bg-rose-950' },
  { name: 'Forest', value: 'bg-emerald-950' },
  { name: 'Royal', value: 'bg-indigo-950' },
  { name: 'Bronze', value: 'bg-amber-950' },
];

const ACCENT_COLORS = [
  { name: 'Default', value: null },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Neon Green', value: '#00ff9f' },
];

export const ProfileThemeCustomizer = ({
  state,
  onChange,
  onReset,
  onPreview,
}: ProfileThemeCustomizerProps) => {
  const [activeTab, setActiveTab] = useState<TabId>('themes');

  const handleThemeSelect = (preset: ThemePreset) => {
    console.log('Theme selected:', preset); // Debug log
    const theme = THEME_PRESETS[preset];
    onChange({
      themePreset: preset,
      backgroundType: theme.defaultBackground.type,
      backgroundValue: theme.defaultBackground.value,
      backgroundBlur: theme.defaultBackground.blur,
      backgroundOpacity: theme.defaultBackground.opacity,
      effectGrain: theme.defaultEffects.grain,
      effectNeonGlow: theme.defaultEffects.neonGlow,
      effectScanlines: theme.defaultEffects.scanlines,
      effectHolographic: theme.defaultEffects.holographic,
      effectMotionGradient: theme.defaultEffects.motionGradient,
    });
  };

  return (
    <div className="space-y-4">
      {/* Custom Tab Buttons - No nested Tabs component */}
      <div className="grid w-full grid-cols-5 h-auto p-1 bg-muted/50 rounded-lg gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 py-2 px-1 text-xs rounded-md transition-all",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="h-[350px] overflow-y-auto pr-2 scrollbar-thin">
        {/* THEMES TAB */}
        {activeTab === 'themes' && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Choose Your Vibe</Label>
            <div className="grid gap-3">
              {Object.values(THEME_PRESETS).map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleThemeSelect(theme.id)}
                  className={cn(
                    "relative p-4 rounded-xl border-2 transition-all text-left w-full",
                    "hover:scale-[1.01] active:scale-[0.99]",
                    state.themePreset === theme.id
                      ? "border-primary bg-primary/10"
                      : "border-border/50 hover:border-border bg-card/50"
                  )}
                >
                  {state.themePreset === theme.id && (
                    <div className="absolute top-3 right-3">
                      <Check className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{theme.icon}</span>
                    <div>
                      <p className="font-medium text-foreground">{theme.name}</p>
                      <p className="text-xs text-muted-foreground">{theme.description}</p>
                    </div>
                  </div>
                  {/* Preview bar */}
                  <div 
                    className="mt-3 h-2 rounded-full overflow-hidden"
                    style={{
                      background: `linear-gradient(90deg, ${theme.primaryAccent}, ${theme.secondaryAccent})`,
                    }}
                  />
                </button>
              ))}
            </div>
            
            {/* Reset Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="w-full mt-4"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Default
            </Button>
          </div>
        )}

        {/* BACKGROUND TAB */}
        {activeTab === 'background' && (
          <div className="space-y-6">
            {/* Background Type */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Background Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['color', 'gradient', 'image'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onChange({ backgroundType: type })}
                    className={cn(
                      "p-3 rounded-lg border text-sm capitalize transition-all",
                      state.backgroundType === type
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/50 hover:border-border text-muted-foreground"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Gradients */}
            {state.backgroundType === 'gradient' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Gradient</Label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_GRADIENTS.map((g) => (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => onChange({ backgroundValue: g.value })}
                      className={cn(
                        "h-14 rounded-lg bg-gradient-to-br transition-all",
                        g.value,
                        state.backgroundValue === g.value
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : "hover:opacity-80"
                      )}
                      title={g.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Colors */}
            {state.backgroundType === 'color' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Color</Label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => onChange({ backgroundValue: c.value })}
                      className={cn(
                        "h-12 rounded-lg transition-all border border-border/30",
                        c.value,
                        state.backgroundValue === c.value
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : "hover:opacity-80"
                      )}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Opacity */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-sm font-medium">Opacity</Label>
                <span className="text-xs text-muted-foreground">{Math.round(state.backgroundOpacity * 100)}%</span>
              </div>
              <Slider
                value={[state.backgroundOpacity]}
                min={0.1}
                max={1}
                step={0.05}
                onValueChange={([v]) => onChange({ backgroundOpacity: v })}
              />
            </div>

            {/* Blur */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label className="text-sm font-medium">Blur</Label>
                <span className="text-xs text-muted-foreground">{state.backgroundBlur}px</span>
              </div>
              <Slider
                value={[state.backgroundBlur]}
                min={0}
                max={20}
                step={1}
                onValueChange={([v]) => onChange({ backgroundBlur: v })}
              />
            </div>

            {/* Overlay Tint */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Overlay Tint</Label>
              <div className="grid grid-cols-4 gap-2">
                {OVERLAY_TINTS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChange({ overlayTint: t.value })}
                    className={cn(
                      "h-10 rounded-lg border transition-all",
                      state.overlayTint === t.value
                        ? "ring-2 ring-primary"
                        : "hover:opacity-80"
                    )}
                    style={{ backgroundColor: t.value || 'transparent' }}
                    title={t.name}
                  />
                ))}
              </div>
            </div>

            {state.overlayTint && (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Label className="text-sm font-medium">Overlay Intensity</Label>
                  <span className="text-xs text-muted-foreground">{Math.round(state.overlayOpacity * 100)}%</span>
                </div>
                <Slider
                  value={[state.overlayOpacity]}
                  min={0}
                  max={1}
                  step={0.05}
                  onValueChange={([v]) => onChange({ overlayOpacity: v })}
                />
              </div>
            )}
          </div>
        )}

        {/* EFFECTS TAB */}
        {activeTab === 'effects' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground">
                Effects adapt to your chosen theme. Some effects may be disabled if "Reduce Motion" is enabled in your system settings.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30">
                <div>
                  <Label className="text-sm font-medium">Film Grain</Label>
                  <p className="text-xs text-muted-foreground">Subtle texture overlay</p>
                </div>
                <Switch
                  checked={state.effectGrain}
                  onCheckedChange={(v) => onChange({ effectGrain: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30">
                <div>
                  <Label className="text-sm font-medium">CRT Scanlines</Label>
                  <p className="text-xs text-muted-foreground">Retro monitor effect</p>
                </div>
                <Switch
                  checked={state.effectScanlines}
                  onCheckedChange={(v) => onChange({ effectScanlines: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30">
                <div>
                  <Label className="text-sm font-medium">Neon Glow</Label>
                  <p className="text-xs text-muted-foreground">Pulsing neon edges</p>
                </div>
                <Switch
                  checked={state.effectNeonGlow}
                  onCheckedChange={(v) => onChange({ effectNeonGlow: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30">
                <div>
                  <Label className="text-sm font-medium">Holographic</Label>
                  <p className="text-xs text-muted-foreground">Rainbow shimmer effect</p>
                </div>
                <Switch
                  checked={state.effectHolographic}
                  onCheckedChange={(v) => onChange({ effectHolographic: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30">
                <div>
                  <Label className="text-sm font-medium">Motion Gradient</Label>
                  <p className="text-xs text-muted-foreground">Animated background colors</p>
                </div>
                <Switch
                  checked={state.effectMotionGradient}
                  onCheckedChange={(v) => onChange({ effectMotionGradient: v })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-primary" />
                  <div>
                    <Label className="text-sm font-medium">Music Visualizer</Label>
                    <p className="text-xs text-muted-foreground">Animated bars when music plays</p>
                  </div>
                </div>
                <Switch
                  checked={state.musicVisualizerEnabled}
                  onCheckedChange={(v) => onChange({ musicVisualizerEnabled: v })}
                />
              </div>
            </div>
          </div>
        )}

        {/* STYLE TAB */}
        {activeTab === 'style' && (
          <div className="space-y-6">
            {/* Font Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Custom Font</Label>
              <div className="grid grid-cols-2 gap-2">
                {APPROVED_FONTS.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => onChange({ customFont: font.id === 'default' ? null : font.value })}
                    className={cn(
                      "p-3 rounded-lg border text-sm transition-all text-left",
                      (state.customFont === font.value || (!state.customFont && font.id === 'default'))
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/50 hover:border-border text-muted-foreground"
                    )}
                    style={{ fontFamily: font.value }}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color Override */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Accent Color</Label>
              <div className="grid grid-cols-4 gap-2">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => onChange({ accentColorOverride: color.value })}
                    className={cn(
                      "h-10 rounded-lg border-2 transition-all flex items-center justify-center",
                      state.accentColorOverride === color.value
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "hover:scale-105"
                    )}
                    style={{ 
                      backgroundColor: color.value || 'hsl(var(--primary))',
                      borderColor: color.value || 'hsl(var(--primary))',
                    }}
                    title={color.name}
                  >
                    {state.accentColorOverride === color.value && (
                      <Check className="w-4 h-4 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LAYOUT TAB */}
        {activeTab === 'layout' && (
          <div className="space-y-6">
            {/* Section Order */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Profile Sections</Label>
              <p className="text-xs text-muted-foreground">
                Drag to reorder your profile sections (coming soon)
              </p>
              <div className="space-y-2">
                {PROFILE_SECTIONS.map((section) => (
                  <div
                    key={section.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all",
                      state.sectionOrder.includes(section.id)
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/50 bg-card/30"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                      {section.icon === 'User' && '👤'}
                      {section.icon === 'Music' && '🎵'}
                      {section.icon === 'BarChart' && '📊'}
                      {section.icon === 'Link' && '🔗'}
                      {section.icon === 'Briefcase' && '💼'}
                      {section.icon === 'Store' && '🏪'}
                      {section.icon === 'Calendar' && '📅'}
                    </div>
                    <span className="text-sm font-medium text-foreground">{section.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Friends */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/30">
              <div>
                <Label className="text-sm font-medium">Show Top Friends</Label>
                <p className="text-xs text-muted-foreground">Display your favorite connections</p>
              </div>
              <Switch
                checked={state.showTopFriends}
                onCheckedChange={(v) => onChange({ showTopFriends: v })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};