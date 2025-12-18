import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useProfileCustomization, ProfileCustomization } from "@/hooks/useProfileCustomization";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProfileMusicSourceSelector, MusicData } from "./ProfileMusicSourceSelector";

interface ProfileCustomizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_GRADIENTS = [
  "from-primary/30 via-background to-accent/20",
  "from-pink-500/30 via-purple-500/20 to-blue-500/30",
  "from-amber-500/30 via-orange-500/20 to-red-500/30",
  "from-emerald-500/30 via-teal-500/20 to-cyan-500/30",
  "from-violet-500/40 via-fuchsia-500/30 to-pink-500/40",
  "from-slate-900 via-purple-900/50 to-slate-900",
  "from-black via-zinc-900 to-black",
  "from-rose-500/20 via-pink-500/30 to-fuchsia-500/20",
];

const PRESET_COLORS = [
  "bg-background",
  "bg-primary/20",
  "bg-pink-500/20",
  "bg-purple-500/20",
  "bg-blue-500/20",
  "bg-emerald-500/20",
  "bg-amber-500/20",
  "bg-rose-500/20",
  "bg-slate-900",
  "bg-zinc-900",
];

export const ProfileCustomizationDialog = ({ open, onOpenChange }: ProfileCustomizationDialogProps) => {
  const { user } = useAuth();
  const { customization, saveCustomization } = useProfileCustomization();
  const [activeTab, setActiveTab] = useState("background");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [backgroundType, setBackgroundType] = useState<'color' | 'gradient' | 'image'>('gradient');
  const [backgroundValue, setBackgroundValue] = useState(PRESET_GRADIENTS[0]);
  const [profileMusicEnabled, setProfileMusicEnabled] = useState(false);
  const [musicData, setMusicData] = useState<MusicData | null>(null);

  // Load existing customization
  useEffect(() => {
    if (customization) {
      setBackgroundType(customization.background_type as 'color' | 'gradient' | 'image');
      setBackgroundValue(customization.background_value);
      setProfileMusicEnabled(customization.profile_music_enabled);
      
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/profile-bg.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      setBackgroundType('image');
      setBackgroundValue(publicUrl);
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
      background_type: backgroundType,
      background_value: backgroundValue,
      profile_music_enabled: profileMusicEnabled,
      profile_music_url: musicData?.url || null,
      profile_music_preview_url: musicData?.previewUrl || null,
      profile_music_title: musicData?.title || null,
      profile_music_artist: musicData?.artist || null,
      profile_music_album_name: musicData?.albumName || null,
      profile_music_album_art_url: musicData?.albumArtUrl || null,
      profile_music_source: musicData?.source || null,
      profile_music_external_id: musicData?.externalId || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Customize Your Profile
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="background" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Background
            </TabsTrigger>
            <TabsTrigger value="music" className="flex items-center gap-2">
              <Music className="w-4 h-4" />
              Music
            </TabsTrigger>
          </TabsList>

          <TabsContent value="background" className="space-y-6 mt-4">
            {/* Gradients */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Gradients</Label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_GRADIENTS.map((gradient, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setBackgroundType('gradient');
                      setBackgroundValue(gradient);
                    }}
                    className={cn(
                      "h-16 rounded-lg bg-gradient-to-br transition-all",
                      gradient,
                      backgroundType === 'gradient' && backgroundValue === gradient
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "hover:opacity-80"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Solid Colors */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Solid Colors</Label>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_COLORS.map((color, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setBackgroundType('color');
                      setBackgroundValue(color);
                    }}
                    className={cn(
                      "h-12 rounded-lg transition-all",
                      color,
                      backgroundType === 'color' && backgroundValue === color
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "hover:opacity-80"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Custom Image */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Custom Image</Label>
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
              {backgroundType === 'image' && backgroundValue && (
                <div className="relative h-24 rounded-lg overflow-hidden">
                  <img 
                    src={backgroundValue} 
                    alt="Background preview" 
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => {
                      setBackgroundType('gradient');
                      setBackgroundValue(PRESET_GRADIENTS[0]);
                    }}
                    className="absolute top-2 right-2 p-1 bg-background/80 rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="music" className="space-y-6 mt-4">
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
        </Tabs>

        <div className="flex gap-3 mt-6">
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
