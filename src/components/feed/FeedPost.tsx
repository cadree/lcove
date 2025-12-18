import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal, Trash2, Play } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useAuth } from '@/contexts/AuthContext';
import { usePosts } from '@/hooks/usePosts';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import CommentThread from './CommentThread';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';

interface Post {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: 'photo' | 'video' | 'text' | null;
  created_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

const FeedPost = ({ post }: { post: Post }) => {
  const { user } = useAuth();
  const { deletePost } = usePosts();
  const {
    likesCount,
    hasLiked,
    comments,
    commentsCount,
    isSaved,
    toggleLike,
    addComment,
    deleteComment,
    toggleSave,
    isLiking,
    isCommenting,
  } = usePostInteractions(post.id);

  const [showComments, setShowComments] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const isOwner = user?.id === post.user_id;

  const handleShare = async () => {
    try {
      await navigator.share({
        title: post.profile?.display_name || 'Check out this post',
        text: post.content || undefined,
        url: window.location.href,
      });
    } catch {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  const handleDelete = () => {
    deletePost.mutate(post.id);
  };

  const toggleVideo = (e: React.MouseEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass-strong rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-primary/20">
            <AvatarImage src={post.profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground font-medium">
              {post.profile?.display_name?.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {post.profile?.display_name || 'User'}
            </h3>
            <time className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </time>
          </div>
        </div>

        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground w-8 h-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border">
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {/* Content */}
      {post.content && (
        <div className="px-4 pb-3">
          <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        </div>
      )}

      {/* Media */}
      {post.media_url && post.media_type !== 'text' && (
        <div className="relative bg-muted/20">
          {post.media_type === 'video' ? (
            <div className="relative">
              <video
                src={post.media_url}
                className="w-full max-h-[500px] object-cover cursor-pointer"
                onClick={toggleVideo}
                playsInline
                loop
              />
              <AnimatePresence>
                {!isPlaying && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-background/20 pointer-events-none"
                  >
                    <div className="w-16 h-16 rounded-full glass flex items-center justify-center">
                      <Play className="w-7 h-7 text-foreground fill-foreground ml-1" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <img
              src={post.media_url}
              alt=""
              className="w-full max-h-[500px] object-cover"
              loading="lazy"
            />
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="px-4 py-3 border-t border-border/30">
        <div className="flex items-center justify-between">
          {/* Left Actions */}
          <div className="flex items-center gap-1">
            {/* Like Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleLike}
              disabled={!user || isLiking}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                hasLiked
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
              }`}
            >
              <motion.div
                animate={hasLiked ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <Heart
                  className={`w-5 h-5 transition-all ${hasLiked ? 'fill-primary' : ''}`}
                />
              </motion.div>
              {likesCount > 0 && (
                <span className="text-sm font-medium">{likesCount}</span>
              )}
            </motion.button>

            {/* Comment Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                showComments
                  ? 'text-foreground bg-accent/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
              }`}
            >
              <MessageCircle className="w-5 h-5" />
              {commentsCount > 0 && (
                <span className="text-sm font-medium">{commentsCount}</span>
              )}
            </motion.button>

            {/* Share Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Right Actions */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleSave}
            disabled={!user}
            className={`p-2 rounded-lg transition-colors ${
              isSaved
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
            }`}
          >
            <motion.div
              animate={isSaved ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-primary' : ''}`} />
            </motion.div>
          </motion.button>
        </div>

        {/* Likes Summary */}
        {likesCount > 0 && (
          <p className="text-sm font-medium text-foreground mt-2">
            {likesCount} {likesCount === 1 ? 'like' : 'likes'}
          </p>
        )}
      </div>

      {/* Comments Section */}
      <Collapsible open={showComments} onOpenChange={setShowComments}>
        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-4 border-t border-border/30"
          >
            <CommentThread
              comments={comments}
              onAddComment={addComment}
              onDeleteComment={deleteComment}
              isCommenting={isCommenting}
            />
          </motion.div>
        </CollapsibleContent>
      </Collapsible>
    </motion.article>
  );
};

export default FeedPost;
