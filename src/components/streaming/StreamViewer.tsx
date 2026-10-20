import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Radio, Users, Coins, Send, X, Clock, PlayCircle, Trash2, Share2, Flag } from 'lucide-react';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { digitalPurchasesEnabled } from '@/lib/platform';
import { shareLink, buildShareUrl } from '@/lib/shareLink';
import { useStream, useStreamReactions, useSendReaction, useTipStream, useJoinStream, useDeleteStream, useStreamPresence } from '@/hooks/useLiveStreams';
import { StreamChat } from './StreamChat';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { WebRTCStreamViewer } from './WebRTCStreamViewer';
import { WebRTCStreamHost } from './WebRTCStreamHost';
import { ReplayPlayer } from './ReplayPlayer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StreamViewerProps {
  streamId: string;
  open: boolean;
  onClose: () => void;
}

const REACTIONS = ['❤️', '🔥', '⭐', '👏', '🎵', '🎧'];

// Stream status helper - single source of truth
type StreamStatus = 'draft' | 'live' | 'ended';
const getStreamStatus = (stream: { is_live: boolean | null; started_at: string | null; ended_at: string | null }): StreamStatus => {
  // If currently live, it's live
  if (stream.is_live === true) return 'live';
  // Only ended if it was started AND then ended
  if (stream.started_at && stream.ended_at) return 'ended';
  // Otherwise it's still a draft (even if ended_at somehow got set without started_at)
  return 'draft';
};

export const StreamViewer: React.FC<StreamViewerProps> = ({ streamId, open, onClose }) => {
  const { user } = useAuth();
  const { stream, isLoading: streamLoading } = useStream(streamId);
  const { profile } = useProfile(stream?.host_id);
  const { reactions } = useStreamReactions(streamId);
  const sendReaction = useSendReaction();
  const tipStream = useTipStream();
  const joinStream = useJoinStream();
  const joinStreamMutate = joinStream.mutate;
  const deleteStream = useDeleteStream();

  const [tipAmount, setTipAmount] = useState('');
  const [tipMessage, setTipMessage] = useState('');
  const [showTipInput, setShowTipInput] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string }[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const cardGifts = digitalPurchasesEnabled();
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const isHost = user?.id === stream?.host_id;
  useStreamPresence(streamId, open && !!user && !isHost && stream?.is_live === true);
  const streamStatus = stream ? getStreamStatus(stream) : 'draft';
  const hasReplay = streamStatus === 'ended' && stream?.replay_available && stream?.replay_url;

  // Join stream on mount (for viewers only, when stream is live)
  useEffect(() => {
    if (open && user && !isHost && streamStatus === 'live') {
      joinStreamMutate(streamId);
    }
  }, [open, user, streamId, isHost, streamStatus, joinStreamMutate]);

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

  const sendCardGift = async (gift: "rose" | "star" | "crown") => {
    try {
      const { data, error } = await supabase.functions.invoke("create-stream-gift", {
        body: { streamId, gift },
      });
      if (error) throw error;
      if (data?.needs_connect) {
        toast.error(data.error || "This host can't receive card gifts yet");
        return;
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error("Stripe did not return a checkout link");
      window.location.assign(data.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the gift checkout");
    }
  };

  const handleTip = () => {
    const amount = parseInt(tipAmount);
    if (!amount || amount < 1) return;
    tipStream.mutate({ streamId, amount, message: tipMessage });
    setTipAmount('');
    setTipMessage('');
    setShowTipInput(false);
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    await deleteStream.mutateAsync(streamId);
    setShowDeleteDialog(false);
    onClose();
  };

  const renderEmbed = () => {
    if (!stream) return null;

    // WebRTC streaming (P2P with OPUS audio)
    if (stream.stream_type === 'webrtc') {
      // REPLAY VIEW: Anyone can watch a replay (host or viewer)
      if (streamStatus === 'ended' && hasReplay) {
        return (
          <ReplayPlayer 
            src={stream.replay_url!}
            poster={stream.thumbnail_url}
            className="w-full h-full"
          />
        );
      }
      
      // HOST VIEW: Show host controls if user is host and stream is draft or live
      if (isHost && streamStatus !== 'ended') {
        return (
          <WebRTCStreamHost 
            streamId={streamId} 
            isLive={streamStatus === 'live'}
            onEnd={onClose}
          />
        );
      }
      
      // VIEWER/HOST: Stream ended without replay
      if (streamStatus === 'ended') {
        return (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/20 to-background">
            <div className="text-center">
              <Radio className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">This stream has ended</p>
              <p className="text-sm text-muted-foreground/60 mt-2">No replay is available</p>
            </div>
          </div>
        );
      }
      
      // VIEWER: Stream is in draft (not yet live)
      if (streamStatus === 'draft') {
        return (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-background">
            <div className="text-center">
              <Clock className="h-16 w-16 text-primary/60 mx-auto mb-4" />
              <p className="text-foreground font-medium">Starting Soon</p>
              <p className="text-sm text-muted-foreground mt-2">The host is setting up their stream</p>
            </div>
          </div>
        );
      }
      
      // VIEWER: Stream is live - connect to watch
      return (
        <WebRTCStreamViewer 
          streamId={streamId}
          hostId={stream.host_id}
          isLive={stream.is_live || false}
          viewerCount={stream.viewer_count || 0}
          thumbnailUrl={stream.thumbnail_url}
        />
      );
    }

    // YouTube embed
    if (stream.stream_type === 'youtube' && stream.external_url) {
      const videoId = stream.external_url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1];
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

    // Default loading state
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-background">
        <div className="text-center">
          <Radio className="h-16 w-16 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Stream loading...</p>
        </div>
      </div>
    );
  };

  if (!stream && !streamLoading) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent
          className="flex w-full min-w-0 max-w-full flex-col gap-0 overflow-x-hidden overflow-y-auto bg-background p-0"
          style={{ maxWidth: "100%", maxHeight: "calc(100dvh - 2rem)" }}
        >
          <DialogTitle className="sr-only">{stream?.title || 'Live Stream'}</DialogTitle>
          <DialogDescription className="sr-only">
            {stream?.description || 'Watch this live stream'}
          </DialogDescription>
          
          {/* Video Area */}
          <div className="relative aspect-video max-h-[34vh] w-full min-w-0 shrink-0 overflow-hidden bg-black">
            {streamLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Radio className="h-16 w-16 text-primary animate-pulse" />
              </div>
            ) : (
              renderEmbed()
            )}

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

            {/* Status Badge (for non-WebRTC streams) */}
            {stream && stream.stream_type !== 'webrtc' && (
              <div className="absolute top-4 left-4 flex gap-2">
                {streamStatus === 'live' && (
                  <Badge className="bg-red-500 animate-pulse">
                    <Radio className="h-3 w-3 mr-1" />
                    LIVE
                  </Badge>
                )}
                {streamStatus === 'draft' && (
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                    <Clock className="h-3 w-3 mr-1" />
                    Starting Soon
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
          <div className="min-w-0 space-y-4 p-4">
            {/* Host Info */}
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar>
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>{profile?.display_name?.charAt(0) || 'D'}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{stream?.title}</h3>
                  <p className="text-sm text-muted-foreground">{profile?.display_name || 'DJ'}</p>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap gap-2">
                {/* Delete Button (Host only) */}
                {isHost && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                )}

                {/* Tip Button (viewers only) */}
                {user && !isHost && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setReportOpen(true)}
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Report
                  </Button>
                )}
                {user && !isHost && streamStatus === 'live' && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => shareLink({
                        title: stream?.title || "Live on Ether",
                        url: buildShareUrl.live(stream?.id || streamId),
                      })}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      onClick={() => setShowTipInput(!showTipInput)}
                    >
                      <Coins className="h-4 w-4 mr-2" />
                      Tip LC
                    </Button>
                    {cardGifts && (["rose", "star", "crown"] as const).map((gift) => (
                      <Button
                        key={gift}
                        type="button"
                        variant="outline"
                        onClick={() => sendCardGift(gift)}
                      >
                        {gift === "rose" ? "Rose $1" : gift === "star" ? "Star $5" : "Crown $10"}
                      </Button>
                    ))}
                  </>
                )}
              </div>
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

            {/* Reactions (only when live) */}
            {streamStatus === 'live' && (
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
            )}
          </div>

          {stream && <StreamChat streamId={stream.id || streamId} />}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="stream"
        targetId={streamId}
      />
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this stream?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the stream and any associated data.
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Type DELETE to confirm:</p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="uppercase"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setDeleteConfirmText('');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleteConfirmText !== 'DELETE' || deleteStream.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Stream
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
