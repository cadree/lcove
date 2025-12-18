import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Music,
  Upload,
  Loader2,
  ExternalLink,
  Image as ImageIcon,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Icons for music services
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

const AppleMusicIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81.84-.553 1.472-1.287 1.88-2.208.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.56-2.075-1.44-.313-.952.078-1.996 1.042-2.44.31-.143.644-.222.986-.298.424-.096.852-.168 1.273-.265.317-.073.544-.257.61-.596.014-.064.02-.13.02-.195v-3.43a.49.49 0 00-.04-.18c-.05-.12-.15-.184-.288-.17-.127.013-.25.04-.373.066l-4.68 1.015c-.035.008-.07.017-.104.028-.147.047-.207.132-.212.283-.003.053-.002.106-.002.16v6.212c0 .203-.01.406-.037.607-.07.49-.25.933-.59 1.3-.398.43-.897.652-1.475.728-.334.044-.67.054-1.003.026-.76-.063-1.418-.38-1.87-.99-.443-.596-.537-1.272-.373-1.984.17-.736.65-1.243 1.323-1.55.32-.146.664-.21 1.01-.27.474-.08.95-.15 1.42-.24.313-.06.535-.22.623-.536.026-.095.035-.197.035-.297V8.08c0-.083.006-.17.024-.25.062-.26.2-.4.47-.454.085-.017.17-.026.257-.04l5.373-1.14c.173-.037.348-.07.523-.1.094-.016.184.014.267.056.06.03.1.08.122.147.014.047.02.097.02.148v3.667h-.002z"/>
  </svg>
);

export interface MusicData {
  source: 'spotify' | 'apple_music' | 'upload';
  url: string | null;
  previewUrl: string | null;
  externalId: string | null;
  title: string;
  artist: string;
  albumName: string;
  albumArtUrl: string | null;
}

interface ProfileMusicSourceSelectorProps {
  initialData?: Partial<MusicData>;
  onMusicChange: (data: MusicData | null) => void;
}

type SourceOption = 'spotify' | 'apple_music' | 'upload' | null;

export const ProfileMusicSourceSelector = ({
  initialData,
  onMusicChange,
}: ProfileMusicSourceSelectorProps) => {
  const { user } = useAuth();
  const [selectedSource, setSelectedSource] = useState<SourceOption>(
    initialData?.source || null
  );
  const [linkUrl, setLinkUrl] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [musicData, setMusicData] = useState<MusicData | null>(
    initialData?.url ? (initialData as MusicData) : null
  );
  
  const audioInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);

  // Extract Spotify track info from URL
  const parseSpotifyUrl = (url: string): { trackId: string | null; type: string | null } => {
    try {
      // Handle various Spotify URL formats
      // https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
      // spotify:track:4cOdK2wGLETKBW3PvgPWqT
      const trackMatch = url.match(/track[/:]([a-zA-Z0-9]+)/);
      if (trackMatch) {
        return { trackId: trackMatch[1], type: 'track' };
      }
      return { trackId: null, type: null };
    } catch {
      return { trackId: null, type: null };
    }
  };

  // Extract Apple Music track info from URL
  const parseAppleMusicUrl = (url: string): { trackId: string | null; albumId: string | null } => {
    try {
      // https://music.apple.com/us/album/song-name/1234567890?i=1234567891
      const albumMatch = url.match(/album\/[^/]+\/(\d+)/);
      const trackMatch = url.match(/[?&]i=(\d+)/);
      return {
        albumId: albumMatch ? albumMatch[1] : null,
        trackId: trackMatch ? trackMatch[1] : null,
      };
    } catch {
      return { trackId: null, albumId: null };
    }
  };

  const handleSpotifyLink = async () => {
    setError(null);
    const { trackId } = parseSpotifyUrl(linkUrl);
    
    if (!trackId) {
      setError("Invalid Spotify URL. Please paste a valid Spotify track link.");
      return;
    }

    setIsProcessing(true);
    try {
      // Use Spotify embed API to get basic info
      // The embed URL allows playback without full OAuth
      const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
      const previewUrl = `https://p.scdn.co/mp3-preview/${trackId}`; // This won't work without API, but embed does
      
      const data: MusicData = {
        source: 'spotify',
        url: linkUrl,
        previewUrl: embedUrl,
        externalId: trackId,
        title: "Spotify Track",
        artist: "Loading...",
        albumName: "",
        albumArtUrl: `https://i.scdn.co/image/${trackId}`, // Placeholder
      };

      // For better UX, let user edit the title/artist
      setMusicData(data);
      onMusicChange(data);
      toast.success("Spotify track connected!");
    } catch (err) {
      setError("Failed to process Spotify link. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAppleMusicLink = async () => {
    setError(null);
    const { trackId, albumId } = parseAppleMusicUrl(linkUrl);
    
    if (!albumId) {
      setError("Invalid Apple Music URL. Please paste a valid Apple Music track link.");
      return;
    }

    setIsProcessing(true);
    try {
      // Apple Music embed URL
      const embedUrl = `https://embed.music.apple.com/us/album/${albumId}${trackId ? `?i=${trackId}` : ''}`;
      
      const data: MusicData = {
        source: 'apple_music',
        url: linkUrl,
        previewUrl: embedUrl,
        externalId: trackId || albumId,
        title: "Apple Music Track",
        artist: "Loading...",
        albumName: "",
        albumArtUrl: null,
      };

      setMusicData(data);
      onMusicChange(data);
      toast.success("Apple Music track connected!");
    } catch (err) {
      setError("Failed to process Apple Music link. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'];
    if (!validTypes.some(type => file.type.includes(type.split('/')[1]))) {
      setError("Please upload an MP3, WAV, or M4A file.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      setError("File size must be under 20MB.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/profile-music-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const data: MusicData = {
        source: 'upload',
        url: publicUrl,
        previewUrl: publicUrl,
        externalId: null,
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "",
        albumName: "",
        albumArtUrl: null,
      };

      setMusicData(data);
      onMusicChange(data);
      toast.success("Music uploaded successfully!");
    } catch (err) {
      console.error('Upload error:', err);
      setError("Failed to upload audio file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArtworkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !musicData) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file.");
      return;
    }

    setIsProcessing(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/profile-music-art-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const updatedData = { ...musicData, albumArtUrl: publicUrl };
      setMusicData(updatedData);
      onMusicChange(updatedData);
      toast.success("Album art uploaded!");
    } catch (err) {
      toast.error("Failed to upload artwork.");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateMusicField = (field: keyof MusicData, value: string) => {
    if (!musicData) return;
    const updated = { ...musicData, [field]: value };
    setMusicData(updated);
    onMusicChange(updated);
  };

  const clearMusic = () => {
    setMusicData(null);
    setSelectedSource(null);
    setLinkUrl("");
    setError(null);
    onMusicChange(null);
  };

  const sourceOptions = [
    {
      id: 'spotify' as const,
      name: 'Spotify',
      icon: SpotifyIcon,
      color: 'text-[#1DB954]',
      bgColor: 'bg-[#1DB954]/10 hover:bg-[#1DB954]/20',
      description: 'Paste a Spotify track link',
    },
    {
      id: 'apple_music' as const,
      name: 'Apple Music',
      icon: AppleMusicIcon,
      color: 'text-[#FA243C]',
      bgColor: 'bg-[#FA243C]/10 hover:bg-[#FA243C]/20',
      description: 'Paste an Apple Music link',
    },
    {
      id: 'upload' as const,
      name: 'Upload File',
      icon: Upload,
      color: 'text-primary',
      bgColor: 'bg-primary/10 hover:bg-primary/20',
      description: 'Upload MP3, WAV, or M4A',
    },
  ];

  // If we have music data, show the edit view
  if (musicData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Current Track Card */}
        <div className="relative p-4 rounded-xl bg-muted/30 border border-border/50 overflow-hidden">
          {/* Album Art Background Blur */}
          {musicData.albumArtUrl && (
            <div 
              className="absolute inset-0 opacity-20 blur-2xl"
              style={{ backgroundImage: `url(${musicData.albumArtUrl})`, backgroundSize: 'cover' }}
            />
          )}
          
          <div className="relative flex gap-4">
            {/* Album Art */}
            <div className="relative group">
              <div className={cn(
                "w-20 h-20 rounded-lg overflow-hidden flex items-center justify-center",
                musicData.albumArtUrl ? "" : "bg-primary/20"
              )}>
                {musicData.albumArtUrl ? (
                  <img 
                    src={musicData.albumArtUrl} 
                    alt="Album art" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-8 h-8 text-primary" />
                )}
              </div>
              
              {musicData.source === 'upload' && (
                <>
                  <button
                    onClick={() => artworkInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                  >
                    <ImageIcon className="w-5 h-5 text-white" />
                  </button>
                  <input
                    ref={artworkInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleArtworkUpload}
                    className="hidden"
                  />
                </>
              )}
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                {musicData.source === 'spotify' && <SpotifyIcon />}
                {musicData.source === 'apple_music' && <AppleMusicIcon />}
                {musicData.source === 'upload' && <Music className="w-4 h-4 text-primary" />}
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              
              <p className="font-medium text-sm truncate">{musicData.title || 'Untitled Track'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {musicData.artist || 'Unknown Artist'}
                {musicData.albumName && ` • ${musicData.albumName}`}
              </p>
            </div>

            {/* Remove Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={clearMusic}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Edit Fields */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Track Title</Label>
            <Input
              value={musicData.title}
              onChange={(e) => updateMusicField('title', e.target.value)}
              placeholder="Enter track title"
              className="h-9"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs">Artist Name</Label>
            <Input
              value={musicData.artist}
              onChange={(e) => updateMusicField('artist', e.target.value)}
              placeholder="Enter artist name"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Album Name (optional)</Label>
            <Input
              value={musicData.albumName}
              onChange={(e) => updateMusicField('albumName', e.target.value)}
              placeholder="Enter album name"
              className="h-9"
            />
          </div>

          {musicData.source === 'upload' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Album Artwork</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => artworkInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4 mr-2" />
                )}
                {musicData.albumArtUrl ? 'Change Artwork' : 'Upload Artwork'}
              </Button>
            </div>
          )}
        </div>

        {/* Preview Link */}
        {musicData.url && musicData.source !== 'upload' && (
          <a
            href={musicData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open in {musicData.source === 'spotify' ? 'Spotify' : 'Apple Music'}
          </a>
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Source Selection */}
      <AnimatePresence mode="wait">
        {!selectedSource ? (
          <motion.div
            key="source-select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-3"
          >
            {sourceOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  setSelectedSource(option.id);
                  setError(null);
                }}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border border-border/50 transition-all",
                  option.bgColor
                )}
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", option.color)}>
                  <option.icon />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">{option.name}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="source-input"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {/* Back Button */}
            <button
              onClick={() => {
                setSelectedSource(null);
                setLinkUrl("");
                setError(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              ← Choose different source
            </button>

            {/* Source-specific UI */}
            {selectedSource === 'spotify' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[#1DB954]">
                  <SpotifyIcon />
                  <span className="font-medium">Connect Spotify Track</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste a Spotify track URL. Visitors will hear a 30-second preview.
                </p>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://open.spotify.com/track/..."
                  className="h-10"
                />
                <Button
                  onClick={handleSpotifyLink}
                  disabled={!linkUrl || isProcessing}
                  className="w-full bg-[#1DB954] hover:bg-[#1DB954]/90"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Connect Track
                </Button>
              </div>
            )}

            {selectedSource === 'apple_music' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[#FA243C]">
                  <AppleMusicIcon />
                  <span className="font-medium">Connect Apple Music Track</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste an Apple Music track URL. Visitors can preview the track.
                </p>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://music.apple.com/..."
                  className="h-10"
                />
                <Button
                  onClick={handleAppleMusicLink}
                  disabled={!linkUrl || isProcessing}
                  className="w-full bg-[#FA243C] hover:bg-[#FA243C]/90"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Connect Track
                </Button>
              </div>
            )}

            {selectedSource === 'upload' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <Upload className="w-6 h-6" />
                  <span className="font-medium">Upload Audio File</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload an MP3, WAV, or M4A file (max 20MB). Full playback for visitors.
                </p>
                <div
                  onClick={() => audioInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed border-border/50 rounded-xl p-8 text-center cursor-pointer transition-colors",
                    "hover:border-primary/50 hover:bg-primary/5"
                  )}
                >
                  {isProcessing ? (
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                  ) : (
                    <>
                      <Music className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">Click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        MP3, WAV, M4A • Max 20MB
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
