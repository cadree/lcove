import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Eye, Send } from 'lucide-react';
import { useStories } from '@/hooks/useStories';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

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
}

interface StoryViewerProps {
  stories: Story[];
  onClose: () => void;
  onNextUser: () => void;
}

const EMOJIS = ['❤️', '🔥', '👏', '😍', '🎉', '💯'];

const StoryViewer = ({ stories, onClose, onNextUser }: StoryViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const { recordView, addReaction } = useStories();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const recordedViewsRef = useRef<Set<string>>(new Set());

  const currentStory = stories[currentIndex];
  const isOwner = user?.id === currentStory?.user_id;

  // Fetch and subscribe to real-time view count for owner
  useEffect(() => {
    if (!currentStory || !isOwner) return;

    // Initial fetch
    const fetchViewCount = async () => {
      const { count } = await supabase
        .from('story_views')
        .select('*', { count: 'exact', head: true })
        .eq('story_id', currentStory.id);
      setViewCount(count || 0);
    };

    fetchViewCount();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`story-views-${currentStory.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'story_views',
          filter: `story_id=eq.${currentStory.id}`,
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
  }, [currentStory?.id, isOwner]);

  // Record view when story opens (only once per story)
  useEffect(() => {
    if (!currentStory || isOwner || !user) return;
    
    // Check if we already recorded this view in this session
    if (recordedViewsRef.current.has(currentStory.id)) return;
    
    // Mark as recorded before making the call to prevent duplicates
    recordedViewsRef.current.add(currentStory.id);
    
    // Only record if not already viewed
    if (!currentStory.has_viewed) {
      recordView.mutate(currentStory.id);
    }
  }, [currentStory?.id, isOwner, user, currentStory?.has_viewed]);

  // Auto-progress timer
  useEffect(() => {
    const duration = currentStory?.media_type === 'video' ? 15000 : 5000;
    const interval = 50;
    const increment = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, currentStory?.media_type]);

  const handleNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onNextUser();
    }
  }, [currentIndex, stories.length, onNextUser]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  const handleReaction = (emoji: string) => {
    addReaction.mutate({ storyId: currentStory.id, emoji });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
            className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
            aria-label="Previous"
          />
          <button
            onClick={handleNext}
            className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
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

          {/* Footer - Reactions or View Count */}
          <div className="absolute bottom-6 left-4 right-4 z-20">
            {isOwner ? (
              // Owner sees view count (real-time updated)
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
            ) : (
              // Viewers see reaction buttons
              <div className="flex items-center justify-center gap-2">
                {EMOJIS.map((emoji) => (
                  <motion.button
                    key={emoji}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleReaction(emoji)}
                    className="w-12 h-12 rounded-full glass flex items-center justify-center text-xl hover:bg-foreground/10 transition-colors"
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default StoryViewer;
