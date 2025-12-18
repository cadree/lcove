import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Trash2, Share2, Play, Pause } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePosts } from '@/hooks/usePosts';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  reactions?: { emoji: string; count: number }[];
  user_reaction?: string | null;
}

const EMOJIS = ['❤️', '🔥', '👏', '😍', '🎉', '💯'];

const FeedPost = ({ post }: { post: Post }) => {
  const { user } = useAuth();
  const { addReaction, removeReaction, deletePost } = usePosts();
  const [showReactions, setShowReactions] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const isOwner = user?.id === post.user_id;

  const handleReaction = (emoji: string) => {
    if (post.user_reaction === emoji) {
      removeReaction.mutate(post.id);
    } else {
      addReaction.mutate({ postId: post.id, emoji });
    }
    setShowReactions(false);
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

  const totalReactions = post.reactions?.reduce((acc, r) => acc + r.count, 0) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass-strong rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-primary/30">
            <AvatarImage src={post.profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground">
              {post.profile?.display_name?.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">
              {post.profile?.display_name || 'User'}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border">
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 pb-3">
          <p className="text-foreground whitespace-pre-wrap">{post.content}</p>
        </div>
      )}

      {/* Media */}
      {post.media_url && post.media_type !== 'text' && (
        <div className="relative">
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
                    className="absolute inset-0 flex items-center justify-center bg-background/30"
                  >
                    <div className="w-16 h-16 rounded-full glass flex items-center justify-center">
                      <Play className="w-8 h-8 text-foreground fill-foreground" />
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
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          {/* Reaction Button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReactions(!showReactions)}
              className={`gap-2 ${post.user_reaction ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <span className="text-lg">{post.user_reaction || '🤍'}</span>
              {totalReactions > 0 && (
                <span className="text-sm">{totalReactions}</span>
              )}
            </Button>

            {/* Reaction Picker */}
            <AnimatePresence>
              {showReactions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                  className="absolute bottom-full left-0 mb-2 glass-strong rounded-full px-2 py-1.5 flex gap-1 z-10"
                >
                  {EMOJIS.map((emoji) => (
                    <motion.button
                      key={emoji}
                      whileHover={{ scale: 1.3 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleReaction(emoji)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors ${
                        post.user_reaction === emoji ? 'bg-primary/20' : 'hover:bg-accent'
                      }`}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Reaction Summary */}
          {post.reactions && post.reactions.length > 0 && (
            <div className="flex gap-1">
              {post.reactions.slice(0, 3).map((r) => (
                <span key={r.emoji} className="text-sm">
                  {r.emoji}
                </span>
              ))}
            </div>
          )}

          {/* Share */}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default FeedPost;
