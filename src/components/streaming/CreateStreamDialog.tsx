import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Radio, Youtube, Music2, Headphones } from 'lucide-react';
import { useCreateStream } from '@/hooks/useLiveStreams';

interface CreateStreamDialogProps {
  open: boolean;
  onClose: () => void;
}

type StreamType = 'webrtc' | 'youtube' | 'twitch' | 'soundcloud' | 'opus';

export const CreateStreamDialog: React.FC<CreateStreamDialogProps> = ({ open, onClose }) => {
  const createStream = useCreateStream();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [streamType, setStreamType] = useState<StreamType>('webrtc');
  const [externalUrl, setExternalUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createStream.mutateAsync({
      title,
      description,
      stream_type: streamType,
      external_url: streamType !== 'webrtc' ? externalUrl : undefined,
    });

    onClose();
    setTitle('');
    setDescription('');
    setStreamType('webrtc');
    setExternalUrl('');
  };

  const getUrlPlaceholder = () => {
    switch (streamType) {
      case 'youtube': return 'https://youtube.com/watch?v=...';
      case 'twitch': return 'https://twitch.tv/channel';
      case 'soundcloud': return 'https://soundcloud.com/artist/track';
      case 'opus': return 'https://opus.audio/stream/your-stream-id';
      default: return '';
    }
  };

  const getUrlLabel = () => {
    switch (streamType) {
      case 'youtube': return 'YouTube Video URL';
      case 'twitch': return 'Twitch Channel URL';
      case 'soundcloud': return 'SoundCloud Track URL';
      case 'opus': return 'OPUS Stream URL';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start a Live Stream</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                  <p className="text-xs text-muted-foreground">P2P with OPUS</p>
                </div>
              </Label>
              
              <Label
                htmlFor="opus"
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  streamType === 'opus' ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                <RadioGroupItem value="opus" id="opus" />
                <Headphones className="h-4 w-4" />
                <div className="text-sm">
                  <span className="font-medium">OPUS</span>
                  <p className="text-xs text-muted-foreground">opus.audio</p>
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
              <p>Stream directly from your device using WebRTC with OPUS audio codec for high-quality, low-latency audio.</p>
              <p className="mt-2 text-xs">• Supports up to ~50 concurrent viewers</p>
              <p className="text-xs">• Browser will ask for camera/mic permission</p>
            </div>
          )}

          {streamType === 'opus' && (
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">🎧 OPUS.audio Streaming</p>
              <p>Connect your OPUS.audio stream to broadcast to LC members.</p>
              <p className="mt-2 text-xs">• Professional DJ streaming platform</p>
              <p className="text-xs">• High-quality audio streaming</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={createStream.isPending}>
              {streamType === 'webrtc' ? 'Setup Stream' : 'Create Stream'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
