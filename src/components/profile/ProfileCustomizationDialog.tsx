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
  Loader2,
} from "lucide-react";
import { useProfileCustomization } from "@/hooks/useProfileCustomization";
import { useProfileLayout } from "@/hooks/useProfileLayout";
import { explicitSectionOrder, explicitShowTopFriends, sectionFieldsForSave, sectionStateFromLayout } from "@/lib/profileSections";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errorMessage";
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
  const { customization, isLoading: customizationLoading, saveCustomization } = useProfileCustomization();
  const { layout, isLoading: layoutLoading } = useProfileLayout();
  const [activeTab, setActiveTab] = useState("customize");
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const [ready, setReady] = useState(false);

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
    sectionOrder: sectionStateFromLayout([]).sectionOrder,
    showTopFriends: true,
    musicVisualizerEnabled: false,
  });

  // Music state
  const [profileMusicEnabled, setProfileMusicEnabled] = useState(false);
  const [musicData, setMusicData] = useState<MusicData | null>(null);

  // Load saved theme once. Section toggles follow the live profile unless the member set them.
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      setReady(false);
      return;
    }
    if (initializedRef.current || customizationLoading || layoutLoading) return;
    initializedRef.current = true;
    const derived = sectionStateFromLayout(layout);
    const storedOrder = explicitSectionOrder(customization);
    const storedFriends = explicitShowTopFriends(customization);
    setCustomizationState({
      themePreset: (customization?.theme_preset as ThemePreset) || 'clean_modern',
      backgroundType: (customization?.background_type as 'color' | 'gradient' | 'image') || 'gradient',
      backgroundValue: customization?.background_value || 'from-primary/30 via-background to-accent/20',
      backgroundOpacity: customization?.background_opacity ?? 1,
      backgroundBlur: customization?.background_blur ?? 0,
      overlayTint: customization?.overlay_tint ?? null,
      overlayOpacity: customization?.overlay_opacity ?? 0,
      effectGrain: customization?.effect_grain ?? false,
      effectNeonGlow: customization?.effect_neon_glow ?? false,
      effectScanlines: customization?.effect_scanlines ?? false,
      effectHolographic: customization?.effect_holographic ?? false,
      effectMotionGradient: customization?.effect_motion_gradient ?? false,
      customFont: customization?.custom_font ?? null,
      accentColorOverride: customization?.accent_color_override ?? null,
      sectionOrder: storedOrder ?? derived.sectionOrder,
      showTopFriends: storedFriends ?? derived.showTopFriends,
      musicVisualizerEnabled: customization?.music_visualizer_enabled ?? false,
    });
    setReady(true);

    setProfileMusicEnabled(customization?.profile_music_enabled ?? false);

    if (customization?.profile_music_url || customization?.profile_music_preview_url) {
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
  }, [open, customization, customizationLoading, layout, layoutLoading]);
  
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
      sectionOrder: sectionStateFromLayout(layout).sectionOrder,
      showTopFriends: sectionStateFromLayout(layout).showTopFriends,
      musicVisualizerEnabled: false,
    });
    toast.success("Reset to default theme");
  };

  const handlePreview = () => {
    toast.info("Preview mode - changes shown but not saved yet");
  };

  const handleImageUpload = async (file: File) => {
    if (!file || !user) return;
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    setCustomizationState(prev => ({ ...prev, backgroundType: 'image' }));

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
      toast.error(errorMessage(error, 'Failed to upload image'));
    } finally {
      URL.revokeObjectURL(previewUrl);
      setLocalPreview(null);
      setUploading(false);
    }
  };

  const handleMusicChange = (data: MusicData | null) => {
    setMusicData(data);
  };

  const handleSave = async () => {
    if (!ready) return;
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
      // Layout. Null keeps the profile the member already has.
      ...sectionFieldsForSave(customizationState, layout),
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
                onBackgroundFile={handleImageUpload}
                backgroundUploading={uploading}
                backgroundPreviewUrl={localPreview}
              />
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
            disabled={!ready || saveCustomization.isPending || customizationLoading || layoutLoading}
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
