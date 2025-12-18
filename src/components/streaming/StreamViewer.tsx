import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Radio, Users, Coins, Heart, Flame, Star, ThumbsUp, Send, X } from 'lucide-react';
import { LiveStream, useStream, useStreamReactions, useSendReaction, useTipStream, useJoinStream } from '@/hooks/useLiveStreams';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { WebRTCStreamViewer } from './WebRTCStreamViewer';
import { WebRTCStreamHost } from './WebRTCStreamHost';

interface StreamViewerProps {
  streamId: string;
  open: boolean;
  onClose: () => void;
}

const REACTIONS = ['❤️', '🔥', '⭐', '👏', '🎵', '🎧'];

export const StreamViewer: React.FC<StreamViewerProps> = ({ streamId, open, onClose }) => {
  const { user } = useAuth();
  const { stream } = useStream(streamId);
  const { profile } = useProfile(stream?.host_id);
  const { reactions } = useStreamReactions(streamId);
  const sendReaction = useSendReaction();
  const tipStream = useTipStream();
  const joinStream = useJoinStream();

  const [tipAmount, setTipAmount] = useState('');
  const [tipMessage, setTipMessage] = useState('');
  const [showTipInput, setShowTipInput] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string }[]>([]);

  const isHost = user?.id === stream?.host_id;

  // Join stream on mount
  useEffect(() => {
    if (open && user && !isHost) {
      joinStream.mutate(streamId);
    }
  }, [open, user, streamId, isHost]);

  // Show floating reactions
  useEffect(() => {
    if (reactions.length > 0) {
      const latest = reactions[0];
      setFloatingReactions(prev => [...prev, { id: latest.id, emoji: latest.emoji }]);
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== latest.id));
      }, 2000);
    }
  }, [reactions]);

  const handleReaction = (emoji: string) => {
    if (!user) return;
    sendReaction.mutate({ streamId, emoji });
  };

  const handleTip = () => {
    const amount = parseInt(tipAmount);
    if (!amount || amount < 1) return;
    tipStream.mutate({ streamId, amount, message: tipMessage });
    setTipAmount('');
    setTipMessage('');
    setShowTipInput(false);
  };

  const renderEmbed = () => {
    if (!stream) return null;

    // Check if this is a replay
    const isReplay = !stream.is_live && stream.replay_available;

    // WebRTC streaming (P2P with OPUS audio)
    if (stream.stream_type === 'webrtc') {
      if (isHost && stream.is_live) {
        return (
          <WebRTCStreamHost 
            streamId={streamId} 
            onEnd={onClose}
          />
        );
      }
      
      // Show replay message or connect to live stream
      if (isReplay) {
        return (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
            <div className="text-center p-6">
              <Radio className="h-16 w-16 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Stream Replay</h3>
              <p className="text-muted-foreground mb-4">
                This stream has ended but was saved as a replay.
              </p>
              {stream.replay_url ? (
                <video 
                  src={stream.replay_url} 
                  controls 
                  className="w-full max-w-lg mx-auto rounded-lg"
                  autoPlay
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Replay data is available for this session.
                </p>
              )}
            </div>
          </div>
        );
      }
      
      if (!stream.is_live) {
        return (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
            <div className="text-center">
              <Radio className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">This stream has ended</p>
              <p className="text-sm text-muted-foreground/60 mt-2">No replay available</p>
            </div>
          </div>
        );
      }
      
      return (
        <WebRTCStreamViewer 
          streamId={streamId}
          hostId={stream.host_id}
          isLive={stream.is_live}
          viewerCount={stream.viewer_count}
        />
      );
    }

    // YouTube embed
    if (stream.stream_type === 'youtube' && stream.external_url) {
      const videoId = stream.external_url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
      if (videoId) {
        return (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        );
      }
    }

    // Twitch embed
    if (stream.stream_type === 'twitch' && stream.external_url) {
      const channel = stream.external_url.match(/twitch\.tv\/(\w+)/)?.[1];
      if (channel) {
        return (
          <iframe
            className="w-full h-full"
            src={`https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}`}
            allowFullScreen
          />
        );
      }
    }

    // SoundCloud embed
    if (stream.stream_type === 'soundcloud' && stream.external_url) {
      return (
        <iframe
          className="w-full h-full"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(stream.external_url)}&color=%23ff69b4&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`}
        />
      );
    }

    // OPUS.audio embed (external streaming platform)
    if (stream.stream_type === 'opus' && stream.external_url) {
      // OPUS.audio uses iframe embeds
      const opusMatch = stream.external_url.match(/opus\.audio\/(?:embed\/)?([a-zA-Z0-9-]+)/);
      const streamKey = opusMatch?.[1];
      
      if (streamKey) {
        return (
          <iframe
            className="w-full h-full"
            src={`https://opus.audio/embed/${streamKey}?autoplay=true`}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        );
      }
      
      // Fallback for direct URL
      return (
        <iframe
          className="w-full h-full"
          src={stream.external_url}
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      );
    }

    // Default placeholder for unrecognized stream types
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
        <div className="text-center">
          <Radio className="h-16 w-16 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Stream loading...</p>
        </div>
      </div>
    );
  };

  if (!stream) return null;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background">
        <DialogTitle className="sr-only">{stream.title}</DialogTitle>
        
        {/* Video Area */}
        <div className="relative aspect-video bg-black">
          {renderEmbed()}

          {/* Floating Reactions */}
          <AnimatePresence>
            {floatingReactions.map((reaction) => (
              <motion.div
                key={reaction.id}
                initial={{ opacity: 1, y: 0, x: Math.random() * 100 }}
                animate={{ opacity: 0, y: -200 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2 }}
                className="absolute bottom-20 right-10 text-4xl pointer-events-none"
              >
                {reaction.emoji}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Live Badge & Stats (only for non-WebRTC, as WebRTC has its own) */}
          {stream.stream_type !== 'webrtc' && (
            <div className="absolute top-4 left-4 flex gap-2">
              {stream.is_live && (
                <Badge className="bg-red-500 animate-pulse">
                  <Radio className="h-3 w-3 mr-1" />
                  LIVE
                </Badge>
              )}
              <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                <Users className="h-3 w-3 mr-1" />
                {stream.viewer_count}
              </Badge>
            </div>
          )}

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 bg-background/50 backdrop-blur-sm z-10"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Controls */}
        <div className="p-4 space-y-4">
          {/* Host Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback>{profile?.display_name?.charAt(0) || 'D'}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{stream.title}</h3>
                <p className="text-sm text-muted-foreground">{profile?.display_name || 'DJ'}</p>
              </div>
            </div>

            {/* Tip Button */}
            {user && user.id !== stream.host_id && (
              <Button 
                variant="outline" 
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={() => setShowTipInput(!showTipInput)}
              >
                <Coins className="h-4 w-4 mr-2" />
                Tip LC
              </Button>
            )}
          </div>

          {/* Tip Input */}
          {showTipInput && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex gap-2"
            >
              <Input
                type="number"
                placeholder="Amount"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                className="w-24"
              />
              <Input
                placeholder="Message (optional)"
                value={tipMessage}
                onChange={(e) => setTipMessage(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleTip} disabled={tipStream.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* Reactions */}
          <div className="flex gap-2 justify-center">
            {REACTIONS.map((emoji) => (
              <Button
                key={emoji}
                variant="outline"
                size="lg"
                className="text-2xl hover:scale-110 transition-transform"
                onClick={() => handleReaction(emoji)}
                disabled={!user}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
