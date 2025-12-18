import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Palette, 
  Music, 
  Sparkles,
  Upload,
  Loader2,
  X
} from "lucide-react";
import { useProfileCustomization, ProfileCustomization, DEFAULT_CUSTOMIZATION } from "@/hooks/useProfileCustomization";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProfileMusicSourceSelector, MusicData } from "./ProfileMusicSourceSelector";
import { ProfileThemeCustomizer, CustomizationState } from "./ProfileThemeCustomizer";
import { ThemePreset } from "@/lib/profileThemes";

interface ProfileCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileCustomizationDialog = ({ open, onOpenChange }: ProfileCustomizationDialogProps) => {
  const { user } = useAuth();
  const { customization, saveCustomization } = useProfileCustomization();
  const [activeTab, setActiveTab] = useState("customize");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  // Customization state
  const [customizationState, setCustomizationState] = useState<CustomizationState>({
    themePreset: 'clean_modern',
    backgroundType: 'gradient',
    backgroundValue: 'from-primary/30 via-background to-accent/20',
    backgroundOpacity: 1,
    backgroundBlur: 0,
    overlayTint: null,
    overlayOpacity: 0,
    effectGrain: false,
    effectNeonGlow: false,
    effectScanlines: false,
    effectHolographic: false,
    effectMotionGradient: false,
    customFont: null,
    accentColorOverride: null,
    sectionOrder: ['about', 'music', 'stats', 'links'],
    showTopFriends: false,
    musicVisualizerEnabled: false,
  });

  // Music state
  const [profileMusicEnabled, setProfileMusicEnabled] = useState(false);
  const [musicData, setMusicData] = useState<MusicData | null>(null);

  // Load existing customization - only once when data first arrives
  useEffect(() => {
    if (customization && !initializedRef.current) {
      initializedRef.current = true;
      setCustomizationState({
        themePreset: (customization.theme_preset as ThemePreset) || 'clean_modern',
        backgroundType: customization.background_type as 'color' | 'gradient' | 'image',
        backgroundValue: customization.background_value || 'from-primary/30 via-background to-accent/20',
        backgroundOpacity: customization.background_opacity ?? 1,
        backgroundBlur: customization.background_blur ?? 0,
        overlayTint: customization.overlay_tint,
        overlayOpacity: customization.overlay_opacity ?? 0,
        effectGrain: customization.effect_grain ?? false,
        effectNeonGlow: customization.effect_neon_glow ?? false,
        effectScanlines: customization.effect_scanlines ?? false,
        effectHolographic: customization.effect_holographic ?? false,
        effectMotionGradient: customization.effect_motion_gradient ?? false,
        customFont: customization.custom_font,
        accentColorOverride: customization.accent_color_override,
        sectionOrder: customization.section_order || ['about', 'music', 'stats', 'links'],
        showTopFriends: customization.show_top_friends ?? false,
        musicVisualizerEnabled: customization.music_visualizer_enabled ?? false,
      });
      
      setProfileMusicEnabled(customization.profile_music_enabled ?? false);
      
      if (customization.profile_music_url || customization.profile_music_preview_url) {
        setMusicData({
          source: (customization.profile_music_source as MusicData['source']) || 'upload',
          url: customization.profile_music_url,
          previewUrl: customization.profile_music_preview_url,
          externalId: customization.profile_music_external_id,
          title: customization.profile_music_title || "",
          artist: customization.profile_music_artist || "",
          albumName: customization.profile_music_album_name || "",
          albumArtUrl: customization.profile_music_album_art_url,
        });
      }
    }
  }, [customization]);
  
  // Reset initialized flag when dialog closes
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
    }
  }, [open]);

  const handleCustomizationChange = (changes: Partial<CustomizationState>) => {
    setCustomizationState(prev => ({ ...prev, ...changes }));
  };

  const handleReset = () => {
    setCustomizationState({
      themePreset: 'clean_modern',
      backgroundType: 'gradient',
      backgroundValue: 'from-primary/30 via-background to-accent/20',
      backgroundOpacity: 1,
      backgroundBlur: 0,
      overlayTint: null,
      overlayOpacity: 0,
      effectGrain: false,
      effectNeonGlow: false,
      effectScanlines: false,
      effectHolographic: false,
      effectMotionGradient: false,
      customFont: null,
      accentColorOverride: null,
      sectionOrder: ['about', 'music', 'stats', 'links'],
      showTopFriends: false,
      musicVisualizerEnabled: false,
    });
    toast.success("Reset to default theme");
  };

  const handlePreview = () => {
    toast.info("Preview mode - changes shown but not saved yet");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/profile-bg-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      setCustomizationState(prev => ({
        ...prev,
        backgroundType: 'image',
        backgroundValue: publicUrl,
      }));
      toast.success('Background image uploaded!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleMusicChange = (data: MusicData | null) => {
    setMusicData(data);
  };

  const handleSave = async () => {
    await saveCustomization.mutateAsync({
      // Theme & Background
      theme_preset: customizationState.themePreset,
      background_type: customizationState.backgroundType,
      background_value: customizationState.backgroundValue,
      background_opacity: customizationState.backgroundOpacity,
      background_blur: customizationState.backgroundBlur,
      overlay_tint: customizationState.overlayTint,
      overlay_opacity: customizationState.overlayOpacity,
      // Effects
      effect_grain: customizationState.effectGrain,
      effect_neon_glow: customizationState.effectNeonGlow,
      effect_scanlines: customizationState.effectScanlines,
      effect_holographic: customizationState.effectHolographic,
      effect_motion_gradient: customizationState.effectMotionGradient,
      // Style
      custom_font: customizationState.customFont,
      accent_color_override: customizationState.accentColorOverride,
      // Layout
      section_order: customizationState.sectionOrder,
      show_top_friends: customizationState.showTopFriends,
      // Music
      profile_music_enabled: profileMusicEnabled,
      profile_music_url: musicData?.url || null,
      profile_music_preview_url: musicData?.previewUrl || null,
      profile_music_title: musicData?.title || null,
      profile_music_artist: musicData?.artist || null,
      profile_music_album_name: musicData?.albumName || null,
      profile_music_album_art_url: musicData?.albumArtUrl || null,
      profile_music_source: musicData?.source || null,
      profile_music_external_id: musicData?.externalId || null,
      music_visualizer_enabled: customizationState.musicVisualizerEnabled,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[85vh] overflow-hidden flex flex-col mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Customize Your Profile
          </DialogTitle>
          <DialogDescription className="sr-only">
            Customize your profile theme, background, effects, and music settings.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customize" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Customize
            </TabsTrigger>
            <TabsTrigger value="music" className="flex items-center gap-2">
              <Music className="w-4 h-4" />
              Music
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="customize" className="mt-0 h-full">
              <ProfileThemeCustomizer
                state={customizationState}
                onChange={handleCustomizationChange}
                onReset={handleReset}
                onPreview={handlePreview}
              />
              
              {/* Image upload for background */}
              {customizationState.backgroundType === 'image' && (
                <div className="mt-4 space-y-3">
                  <Label className="text-sm font-medium">Background Image</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex-1"
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Upload Image
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                  {customizationState.backgroundValue?.startsWith('http') && (
                    <div className="relative h-20 rounded-lg overflow-hidden">
                      <img 
                        src={customizationState.backgroundValue} 
                        alt="Background preview" 
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handleCustomizationChange({
                          backgroundType: 'gradient',
                          backgroundValue: 'from-primary/30 via-background to-accent/20',
                        })}
                        className="absolute top-2 right-2 p-1 bg-background/80 rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="music" className="space-y-6 mt-0">
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-sm text-muted-foreground">
                  Add a song that plays when visitors view your profile — just like the MySpace days!
                </p>
              </div>

              {/* Enable Music Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Enable Profile Music</Label>
                  <p className="text-xs text-muted-foreground">Play music when visitors view your profile</p>
                </div>
                <Switch
                  checked={profileMusicEnabled}
                  onCheckedChange={setProfileMusicEnabled}
                />
              </div>

              {/* Music Source Selector */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Your Profile Song</Label>
                <ProfileMusicSourceSelector
                  initialData={musicData || undefined}
                  onMusicChange={handleMusicChange}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex gap-3 pt-4 border-t border-border/50 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            className="flex-1" 
            onClick={handleSave}
            disabled={saveCustomization.isPending}
          >
            {saveCustomization.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
