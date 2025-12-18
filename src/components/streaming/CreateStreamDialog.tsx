import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Radio, Youtube, Music2 } from 'lucide-react';
import { useCreateStream } from '@/hooks/useLiveStreams';

interface CreateStreamDialogProps {
  open: boolean;
  onClose: () => void;
}

export const CreateStreamDialog: React.FC<CreateStreamDialogProps> = ({ open, onClose }) => {
  const createStream = useCreateStream();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [streamType, setStreamType] = useState<'webrtc' | 'youtube' | 'twitch' | 'soundcloud'>('youtube');
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
    setStreamType('youtube');
    setExternalUrl('');
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
              onValueChange={(v) => setStreamType(v as any)}
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
                <span className="text-sm">P2P WebRTC</span>
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
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
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
              <Label>
                {streamType === 'youtube' && 'YouTube Video URL'}
                {streamType === 'twitch' && 'Twitch Channel URL'}
                {streamType === 'soundcloud' && 'SoundCloud Track URL'}
              </Label>
              <Input
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder={
                  streamType === 'youtube' ? 'https://youtube.com/watch?v=...' :
                  streamType === 'twitch' ? 'https://twitch.tv/channel' :
                  'https://soundcloud.com/artist/track'
                }
                required
              />
            </div>
          )}

          {streamType === 'webrtc' && (
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <p>WebRTC streaming allows direct peer-to-peer connection with your viewers (up to ~50 concurrent viewers).</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={createStream.isPending}>
              Create Stream
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
