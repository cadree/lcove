import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Eye, Heart, Share2, Send } from 'lucide-react';
import { useStories } from '@/hooks/useStories';
import { useAuth } from '@/contexts/AuthContext';
import { useSharingActions } from '@/hooks/useSharing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { notifyStoryLike } from '@/lib/notifications';
import { storyAdvanceHeld } from '@/lib/sharing';
import { ShareSheet } from '@/components/share/ShareSheet';
import { toast } from 'sonner';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'photo' | 'video';
  is_live: boolean;
  created_at: string;
  expires_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  view_count?: number;
  has_viewed?: boolean;
  credit_user_id?: string | null;
  credit_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface StoryViewerProps {
  stories: Story[];
  onClose: () => void;
  onNextUser: () => void;
}

const StoryViewer = ({ stories, onClose, onNextUser }: StoryViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [hearted, setHearted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { recordView } = useStories();
  const { sendStoryReply } = useSharingActions();
  const { user } = useAuth();
  const navigate = useNavigate();
  const recordedViewsRef = useRef<Set<string>>(new Set());
  const heldRef = useRef(false);
  const replyFocusedRef = useRef(false);
  const shareOpenRef = useRef(false);
  const replyRef = useRef('');

  const currentStory = stories[currentIndex];
  const isOwner = user?.id === currentStory?.user_id;

  const syncHold = () => {
    const held = storyAdvanceHeld({
      replyFocused: replyFocusedRef.current,
      shareOpen: shareOpenRef.current,
      sending: sendStoryReply.isPending,
      hasDraft: replyRef.current.trim().length > 0,
    });
    heldRef.current = held;
    setPaused(held);
  };
  const syncHoldRef = useRef(syncHold);
  syncHoldRef.current = syncHold;
  const storyId = currentStory?.id;
  const storyHasViewed = currentStory?.has_viewed;
  const storyMediaType = currentStory?.media_type;
  const recordStoryView = recordView.mutate;

  // Fetch and subscribe to real-time view count for owner
  useEffect(() => {
    if (!storyId || !isOwner) return;

    // Initial fetch
    const fetchViewCount = async () => {
      const { count } = await supabase
        .from('story_views')
        .select('*', { count: 'exact', head: true })
        .eq('story_id', storyId);
      setViewCount(count || 0);
    };

    fetchViewCount();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`story-views-${storyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'story_views',
          filter: `story_id=eq.${storyId}`,
        },
        () => {
          // Increment view count on new view
          setViewCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storyId, isOwner]);

  // Record view when story opens (only once per story)
  useEffect(() => {
    if (!storyId || isOwner || !user) return;
    
    // Check if we already recorded this view in this session
    if (recordedViewsRef.current.has(storyId)) return;
    
    // Mark as recorded before making the call to prevent duplicates
    recordedViewsRef.current.add(storyId);
    
    // Only record if not already viewed
    if (!storyHasViewed) {
      recordStoryView(storyId);
    }
  }, [storyId, isOwner, user, storyHasViewed, recordStoryView]);

  const handleNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onNextUser();
    }
  }, [currentIndex, stories.length, onNextUser]);

  // Auto-progress timer
  useEffect(() => {
    if (!storyId || isOwner || !user) return;
    let cancel = false;
    supabase
      .from('story_reactions')
      .select('emoji')
      .eq('story_id', storyId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancel) setHearted(data?.emoji === '❤️');
      });
    replyRef.current = '';
    setReply('');
    syncHoldRef.current();
    return () => {
      cancel = true;
    };
  }, [storyId, isOwner, user]);

  useEffect(() => {
    syncHoldRef.current();
  }, [sendStoryReply.isPending]);

  useEffect(() => {
    if (paused) return;
    const duration = storyMediaType === 'video' ? 15000 : 5000;
    const interval = 50;
    const increment = (interval / duration) * 100;

    const timer = setInterval(() => {
      if (heldRef.current) return;
      setProgress((prev) => {
        if (heldRef.current) return prev;
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [storyMediaType, handleNext, paused]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  const handleHeart = async () => {
    if (!user || !currentStory) return;
    const next = !hearted;
    setHearted(next);
    if (!next) {
      const { error } = await supabase
        .from('story_reactions')
        .delete()
        .eq('story_id', currentStory.id)
        .eq('user_id', user.id);
      if (error) setHearted(true);
      return;
    }
    const { error } = await supabase.from('story_reactions').upsert({
      story_id: currentStory.id,
      user_id: user.id,
      emoji: '❤️',
    }, { onConflict: 'story_id,user_id' });
    if (error) {
      setHearted(false);
      toast.error('Could not send');
      return;
    }
    const { data: profile } = await supabase
      .from('profiles_public')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();
    try {
      await notifyStoryLike(currentStory.user_id, profile?.display_name || 'Someone', currentStory.id);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : 'Could not notify';
      toast.error(message);
    }
  };

  const handleReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentStory || !reply.trim()) return;
    try {
      await sendStoryReply.mutateAsync({
        storyId: currentStory.id,
        ownerId: currentStory.user_id,
        text: reply,
      });
      replyRef.current = '';
      setReply('');
      syncHold();
      toast.success('Sent');
    } catch {
      // The send action already reports the error.
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLElement && target.closest('input, textarea')) return;
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  if (!currentStory) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Story Container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-md h-[85vh] max-h-[900px] rounded-3xl overflow-hidden bg-card shadow-2xl"
        >
          {/* Progress Bars */}
          <div className="absolute top-4 left-4 right-4 z-20 flex gap-1">
            {stories.map((_, idx) => (
              <div
                key={idx}
                className="flex-1 h-0.5 bg-foreground/20 rounded-full overflow-hidden"
              >
                <motion.div
                  className="h-full bg-foreground"
                  initial={{ width: 0 }}
                  animate={{
                    width:
                      idx < currentIndex
                        ? '100%'
                        : idx === currentIndex
                        ? `${progress}%`
                        : '0%',
                  }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-8 left-4 right-4 z-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-muted border-2 border-foreground/20">
                {currentStory.profile?.avatar_url ? (
                  <img
                    src={currentStory.profile.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    {currentStory.profile?.display_name?.charAt(0) || '?'}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {currentStory.profile?.display_name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-foreground hover:bg-foreground/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Media Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStory.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              {currentStory.media_type === 'video' ? (
                <video
                  src={currentStory.media_url}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={currentStory.media_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-background/40 pointer-events-none" />

          {/* Navigation Areas */}
          <button
            onClick={handlePrev}
            className="absolute left-0 top-0 bottom-28 w-1/3 z-10"
            aria-label="Previous"
          />
          <button
            onClick={handleNext}
            className="absolute right-0 top-0 bottom-28 w-1/3 z-10"
            aria-label="Next"
          />

          {/* Navigation Buttons */}
          {currentIndex > 0 && (
            <Button
              variant="glass"
              size="icon"
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          {currentIndex < stories.length - 1 && (
            <Button
              variant="glass"
              size="icon"
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          )}

          {currentStory.credit_user_id && (
            <button
              type="button"
              className="absolute bottom-28 left-4 z-30 flex min-h-11 items-center gap-2 rounded-full bg-background/80 px-3 text-foreground"
              onClick={() => {
                onClose();
                navigate(`/profile/${currentStory.credit_user_id}`);
              }}
            >
              <span className="mono-label text-[9px] text-muted-foreground">Original</span>
              <span className="text-sm font-semibold">
                {currentStory.credit_profile?.display_name || 'Creator'}
              </span>
            </button>
          )}

          {/* Footer */}
          <div className="absolute bottom-4 left-4 right-4 z-30">
            {isOwner ? (
              <div className="flex items-center justify-between gap-2">
                <motion.div
                  key={viewCount}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2 text-foreground/80"
                >
                  <Eye className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {viewCount} {viewCount === 1 ? 'view' : 'views'}
                  </span>
                </motion.div>
                <Button
                  variant="glass"
                  size="icon"
                  aria-label="Share"
                  onPointerDown={() => {
                    shareOpenRef.current = true;
                    syncHold();
                  }}
                  onClick={() => {
                    shareOpenRef.current = true;
                    setShareOpen(true);
                    syncHold();
                  }}
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <form
                onSubmit={handleReply}
                onPointerDown={() => {
                  replyFocusedRef.current = true;
                  syncHold();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={reply}
                  onChange={(event) => {
                    replyRef.current = event.target.value;
                    setReply(event.target.value);
                    syncHold();
                  }}
                  onFocus={() => {
                    replyFocusedRef.current = true;
                    syncHold();
                  }}
                  onBlur={() => {
                    replyFocusedRef.current = false;
                    syncHold();
                  }}
                  placeholder="Send message"
                  aria-label="Send message"
                  className="min-h-11 flex-1 bg-background/80"
                />
                {reply.trim() && (
                  <Button type="submit" variant="glass" size="icon" aria-label="Send" disabled={sendStoryReply.isPending}>
                    <Send className="h-5 w-5" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="glass"
                  size="icon"
                  aria-label={hearted ? 'Unlike' : 'Like'}
                  onClick={handleHeart}
                >
                  <Heart className={`h-5 w-5 ${hearted ? 'fill-primary text-primary' : ''}`} />
                </Button>
                <Button
                  type="button"
                  variant="glass"
                  size="icon"
                  aria-label="Share"
                  onPointerDown={() => {
                    shareOpenRef.current = true;
                    syncHold();
                  }}
                  onPointerCancel={() => {
                    if (!shareOpenRef.current) return;
                    shareOpenRef.current = shareOpen;
                    syncHold();
                  }}
                  onClick={() => {
                    shareOpenRef.current = true;
                    setShareOpen(true);
                    syncHold();
                  }}
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
      <ShareSheet
        open={shareOpen}
        onOpenChange={(next) => {
          shareOpenRef.current = next;
          setShareOpen(next);
          syncHold();
        }}
        target={{
          kind: 'story',
          story: {
            id: currentStory.id,
            user_id: currentStory.user_id,
            media_url: currentStory.media_url,
            media_type: currentStory.media_type,
            profile: currentStory.profile,
          },
        }}
      />
    </motion.div>
  );
};

export default StoryViewer;
