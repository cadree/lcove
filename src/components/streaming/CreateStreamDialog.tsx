import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Radio, Youtube, Music2, ImagePlus, X, Loader2 } from 'lucide-react';
import { useCreateStream } from '@/hooks/useLiveStreams';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface CreateStreamDialogProps {
  open: boolean;
  onClose: () => void;
  onStreamCreated?: (streamId: string) => void;
}

type StreamType = 'webrtc' | 'youtube' | 'twitch' | 'soundcloud';

export const CreateStreamDialog: React.FC<CreateStreamDialogProps> = ({ open, onClose, onStreamCreated }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const createStream = useCreateStream();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [streamType, setStreamType] = useState<StreamType>('webrtc');
  const [externalUrl, setExternalUrl] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select an image under 5MB',
          variant: 'destructive',
        });
        return;
      }
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setThumbnailPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadThumbnail = async (): Promise<string | null> => {
    if (!thumbnailFile || !user) return null;
    
    try {
      const fileExt = thumbnailFile.name.split('.').pop();
      const fileName = `stream-thumbnails/${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, thumbnailFile, {
          contentType: thumbnailFile.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      return null;
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsUploading(true);
    
    try {
      // Upload thumbnail if selected
      let thumbnailUrl: string | undefined;
      if (thumbnailFile) {
        const url = await uploadThumbnail();
        if (url) thumbnailUrl = url;
      }

      const result = await createStream.mutateAsync({
        title,
        description,
        stream_type: streamType,
        external_url: streamType !== 'webrtc' ? externalUrl : undefined,
        thumbnail_url: thumbnailUrl,
      });

      // Open the stream viewer for WebRTC streams
      if (streamType === 'webrtc' && result?.id && onStreamCreated) {
        onStreamCreated(result.id);
      }

      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating stream:', error);
      toast({
        title: 'Failed to create stream',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStreamType('webrtc');
    setExternalUrl('');
    setThumbnailFile(null);
    setThumbnailPreview(null);
  };

  const getUrlPlaceholder = () => {
    switch (streamType) {
      case 'youtube': return 'https://youtube.com/watch?v=...';
      case 'twitch': return 'https://twitch.tv/channel';
      case 'soundcloud': return 'https://soundcloud.com/artist/track';
      default: return '';
    }
  };

  const getUrlLabel = () => {
    switch (streamType) {
      case 'youtube': return 'YouTube Video URL';
      case 'twitch': return 'Twitch Channel URL';
      case 'soundcloud': return 'SoundCloud Track URL';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { onClose(); resetForm(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start a Live Stream</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover Art Upload */}
          <div className="space-y-2">
            <Label>Cover Art (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleThumbnailSelect}
              className="hidden"
            />
            
            {thumbnailPreview ? (
              <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                <img 
                  src={thumbnailPreview} 
                  alt="Thumbnail preview" 
                  className="w-full h-full object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={removeThumbnail}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-colors flex flex-col items-center justify-center gap-2"
              >
                <ImagePlus className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Add cover art</span>
                <span className="text-xs text-muted-foreground/60">Recommended: 16:9 ratio</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Stream Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Friday Night Vibes"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's the vibe tonight?"
            />
          </div>

          <div className="space-y-3">
            <Label>Stream Type</Label>
            <RadioGroup
              value={streamType}
              onValueChange={(v) => setStreamType(v as StreamType)}
              className="grid grid-cols-2 gap-2"
            >
              <Label
                htmlFor="webrtc"
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  streamType === 'webrtc' ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                <RadioGroupItem value="webrtc" id="webrtc" />
                <Radio className="h-4 w-4" />
                <div className="text-sm">
                  <span className="font-medium">Camera/Mic</span>
                  <p className="text-xs text-muted-foreground">P2P WebRTC</p>
                </div>
              </Label>
              
              <Label
                htmlFor="youtube"
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  streamType === 'youtube' ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                <RadioGroupItem value="youtube" id="youtube" />
                <Youtube className="h-4 w-4" />
                <span className="text-sm">YouTube</span>
              </Label>
              
              <Label
                htmlFor="twitch"
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  streamType === 'twitch' ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                <RadioGroupItem value="twitch" id="twitch" />
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                </svg>
                <span className="text-sm">Twitch</span>
              </Label>
              
              <Label
                htmlFor="soundcloud"
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors col-span-2 ${
                  streamType === 'soundcloud' ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                <RadioGroupItem value="soundcloud" id="soundcloud" />
                <Music2 className="h-4 w-4" />
                <span className="text-sm">SoundCloud</span>
              </Label>
            </RadioGroup>
          </div>

          {/* URL input for external services */}
          {streamType !== 'webrtc' && (
            <div className="space-y-2">
              <Label>{getUrlLabel()}</Label>
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder={getUrlPlaceholder()}
                required
              />
            </div>
          )}

          {streamType === 'webrtc' && (
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">📹 Camera & Mic Streaming</p>
              <p>Stream directly from your device using WebRTC. Best for quick, casual streams.</p>
              <p className="mt-2 text-xs">• Viewers can watch in real-time</p>
              <p className="text-xs">• Browser will ask for camera/mic permission</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { onClose(); resetForm(); }} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={createStream.isPending || isUploading}>
              {(createStream.isPending || isUploading) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {streamType === 'webrtc' ? 'Setup Stream' : 'Create Stream'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
