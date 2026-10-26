import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Radio, Users, Coins, Send, X, Clock, PlayCircle, Share2, Flag } from 'lucide-react';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { liveKeyboardInset } from '@/lib/liveKeyboard';
import { digitalPurchasesEnabled } from '@/lib/platform';
import { shareLink, buildShareUrl } from '@/lib/shareLink';
import { useStream, useSendReaction, useTipStream, useJoinStream, useStreamPresence, useStreamCheers } from '@/hooks/useLiveStreams';
import { StreamChat } from './StreamChat';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
const WebRTCStreamViewer = lazy(() => import('./WebRTCStreamViewer').then((mod) => ({ default: mod.WebRTCStreamViewer })));
const WebRTCStreamHost = lazy(() => import('./WebRTCStreamHost').then((mod) => ({ default: mod.WebRTCStreamHost })));
const ReplayPlayer = lazy(() => import('./ReplayPlayer').then((mod) => ({ default: mod.ReplayPlayer })));

function LiveMediaFallback() {
  return (
    <div className="flex h-full min-h-[34vh] w-full items-center justify-center text-sm text-muted-foreground">
      Loading live video…
    </div>
  );
}
import { DeleteStreamButton } from './DeleteStreamButton';
import { liveSheetState } from '@/lib/liveSheetHistory';

function useNativeKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active || !Capacitor.isNativePlatform()) {
      setInset(0);
      return;
    }

    const handles: PluginListenerHandle[] = [];
    let cancelled = false;

    const listen = async () => {
      const show = await Keyboard.addListener('keyboardWillShow', (info) => {
        setInset(liveKeyboardInset(info.keyboardHeight));
      });
      const hide = await Keyboard.addListener('keyboardWillHide', () => {
        setInset(0);
      });
      if (cancelled) {
        void show.remove();
        void hide.remove();
        return;
      }
      handles.push(show, hide);
    };

    void listen();
    return () => {
      cancelled = true;
      handles.forEach((handle) => {
        void handle.remove();
      });
      setInset(0);
    };
  }, [active]);

  return inset;
}

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
  const { reactions, cheers } = useStreamCheers(streamId);
  const sendReaction = useSendReaction();
  const tipStream = useTipStream();
  const joinStream = useJoinStream();
  const joinStreamMutate = joinStream.mutate;

  const [tipAmount, setTipAmount] = useState('');
  const [tipMessage, setTipMessage] = useState('');
  const [showTipInput, setShowTipInput] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; x: number }[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [holdHost, setHoldHost] = useState(false);
  // LC tips and card gifts are digital goods. The iOS app hides both (guideline 3.1.1).
  const digitalGoods = digitalPurchasesEnabled();
  const isHost = user?.id === stream?.host_id;
  useStreamPresence(streamId, open && !!user && !isHost && stream?.is_live === true);
  const streamStatus = stream ? getStreamStatus(stream) : 'draft';
  const hasReplay = streamStatus === 'ended' && stream?.replay_available && stream?.replay_url;
  const hosting = stream?.stream_type === "webrtc" && isHost && (streamStatus !== "ended" || holdHost);
  const openedAt = useRef(Date.now());
  const sheetRef = useRef<HTMLDivElement>(null);
  const keyboardInset = useNativeKeyboardInset(open);
  const endGuard = useRef<(() => boolean) | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pushedSheet = useRef(false);

  useEffect(() => {
    if (open) openedAt.current = Date.now();
  }, [open, streamId]);

  useEffect(() => {
    if (keyboardInset <= 0) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.scrollTop = sheet.scrollHeight;
  }, [keyboardInset]);

  useEffect(() => {
    if (isHost && stream?.stream_type === "webrtc" && streamStatus !== "ended") setHoldHost(true);
  }, [isHost, stream?.stream_type, streamStatus]);

  useEffect(() => {
    if (!open) return;
    if (!pushedSheet.current) {
      window.history.pushState(liveSheetState(window.history.state, streamId), "");
      pushedSheet.current = true;
    }
    const onPop = () => {
      pushedSheet.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, streamId]);

  const requestClose = () => {
    if (endGuard.current?.()) return;
    // The button close stays on this page. history.back() returns to the same
    // ?stream= entry, which opens the room again, or leaves Live entirely.
    pushedSheet.current = false;
    onCloseRef.current();
  };

  // Join stream on mount (for viewers only, when stream is live)
  useEffect(() => {
    if (open && user && !isHost && streamStatus === 'live') {
      joinStreamMutate(streamId);
    }
  }, [open, user, streamId, isHost, streamStatus, joinStreamMutate]);

  const seenReactions = useRef(new Set<string>());
  useEffect(() => {
    const latest = reactions[0];
    if (!latest || seenReactions.current.has(latest.id)) return;
    seenReactions.current.add(latest.id);
    const x = 16 + Math.round(Math.random() * 48);
    setFloatingReactions((prev) => [...prev, { id: latest.id, emoji: latest.emoji, x }]);
    const timer = window.setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((item) => item.id !== latest.id));
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [reactions]);

  const handleReaction = (emoji: string) => {
    if (!user) return;
    sendReaction.mutate({ streamId, emoji });
  };

  const sendCardGift = async (gift: "rose" | "star" | "crown") => {
    if (!digitalGoods) return;
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
    if (!digitalGoods) return;
    const amount = parseInt(tipAmount);
    if (!amount || amount < 1) return;
    tipStream.mutate({ streamId, amount, message: tipMessage });
    setTipAmount('');
    setTipMessage('');
    setShowTipInput(false);
  };

  const renderEmbed = () => {
    if (!stream) return null;

    if (stream.stream_type === 'obs_rtmp') {
      return (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted/20 to-background px-6 text-center">
          <p className="text-muted-foreground">OBS streaming has been removed.</p>
        </div>
      );
    }

    if (stream.stream_type === 'webrtc') {
      // HOST VIEW: Keep the host mounted after the row ends so the replay
      // upload and the save-to-phone step can finish. Swapping to the player
      // here used to unmount the recorder before the file was stored.
      if (isHost && (streamStatus !== 'ended' || holdHost)) {
        return (
          <Suspense fallback={<LiveMediaFallback />}>
          <WebRTCStreamHost
            streamId={streamId}
            isLive={streamStatus === 'live'}
            serverCount={stream.viewer_count ?? 0}
            onEnd={() => {
              setHoldHost(false);
              endGuard.current = null;
              requestClose();
            }}
            onClose={requestClose}
            registerEndGuard={(guard) => {
              endGuard.current = guard;
            }}
          />
          </Suspense>
        );
      }

      // REPLAY VIEW: Anyone can watch a replay (host or viewer)
      if (streamStatus === 'ended' && hasReplay) {
        return (
          <Suspense fallback={<LiveMediaFallback />}>
          <ReplayPlayer 
            src={stream.replay_url!}
            poster={stream.thumbnail_url}
            className="w-full h-full"
          />
          </Suspense>
        );
      }
      
      // VIEWER/HOST: Stream ended without replay
      if (streamStatus === 'ended') {
        return (
          <div data-testid="stream-ended" className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/20 to-background">
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
        <Suspense fallback={<LiveMediaFallback />}>
        <WebRTCStreamViewer 
          streamId={streamId}
          hostId={stream.host_id}
          isLive={stream.is_live || false}
          viewerCount={stream.viewer_count || 0}
          thumbnailUrl={stream.thumbnail_url}
        />
        </Suspense>
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
      <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose(); }}>
        <DialogContent
          fullscreen
          className="[&>button]:hidden"
          style={keyboardInset > 0 ? { paddingBottom: keyboardInset } : undefined}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogTitle className="sr-only">{stream?.title || 'Live Stream'}</DialogTitle>
          <DialogDescription className="sr-only">
            {stream?.description || 'Watch this live stream'}
          </DialogDescription>
          
          <div ref={sheetRef} className="flex h-full min-h-0 flex-col overflow-y-auto">
          {/* Video Area */}
          <div className={hosting
            ? "relative w-full min-w-0 shrink-0 bg-black"
            : "relative aspect-video max-h-[38dvh] w-full min-w-0 shrink-0 overflow-hidden bg-black"
          }>
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
                  initial={{ opacity: 1, y: 0, x: reaction.x }}
                  animate={{ opacity: 0, y: -160 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2 }}
                  className="absolute bottom-16 right-6 text-4xl pointer-events-none"
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
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-30 h-11 w-11 bg-background/50 backdrop-blur-sm"
              onClick={requestClose}
              aria-label="Close live"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Controls */}
          <div className="min-w-0 shrink-0 space-y-3 p-3">
            {/* Host Info */}
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="shrink-0">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback>{profile?.display_name?.charAt(0) || 'D'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{stream?.title}</h3>
                  <p className="truncate text-sm text-muted-foreground">{profile?.display_name || 'DJ'}</p>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap gap-2">
                {/* Delete Button (Host only) */}
                {isHost && streamStatus !== 'live' && (
                  <DeleteStreamButton streamId={streamId} onDeleted={requestClose} />
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
                    {digitalGoods && (
                      <Button
                        variant="outline"
                        className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                        onClick={() => setShowTipInput(!showTipInput)}
                      >
                        <Coins className="h-4 w-4 mr-2" />
                        Tip LC
                      </Button>
                    )}
                    {digitalGoods && (["rose", "star", "crown"] as const).map((gift) => (
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
            {digitalGoods && showTipInput && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex w-full min-w-0 gap-2"
              >
                <Input
                  type="number"
                  placeholder="LC"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="w-16 shrink-0 px-2"
                  aria-label="Tip amount"
                />
                <Input
                  placeholder="Message"
                  value={tipMessage}
                  onChange={(e) => setTipMessage(e.target.value)}
                  className="w-auto min-w-0 flex-1"
                  aria-label="Tip message"
                />
                <Button type="button" className="shrink-0 px-3" onClick={handleTip} disabled={tipStream.isPending} aria-label="Send tip">
                  <Send className="h-4 w-4" />
                </Button>
              </motion.div>
            )}

            {cheers.length > 0 && (
              <ul data-testid="cheer-log" className="flex max-h-16 flex-wrap gap-2 overflow-y-auto text-sm">
                {cheers.map((cheer) => (
                  <li key={cheer.id} className="rounded-full bg-muted px-2 py-1">{cheer.label}</li>
                ))}
              </ul>
            )}

            {/* Reactions while the room is open, including for the host */}
            {(streamStatus === 'live' || holdHost) && (
              <div className="grid w-full grid-cols-6 gap-1">
                {REACTIONS.map((emoji) => (
                  <Button
                    key={emoji}
                    variant="outline"
                    className="h-11 w-full min-w-0 px-0 text-xl hover:scale-110 transition-transform"
                    data-testid={`reaction-${emoji}`}
                    onClick={() => handleReaction(emoji)}
                    disabled={!user}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-[9rem] flex-1 overflow-hidden">
            {stream && <StreamChat streamId={stream.id || streamId} className="h-full" />}
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="stream"
        targetId={streamId}
      />
    </>
  );
};
