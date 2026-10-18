import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal, Trash2, Play, Flag } from 'lucide-react';
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
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { shareLink, buildShareUrl } from '@/lib/shareLink';
import { ReportDialog } from '@/components/safety/ReportDialog';

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
  const navigate = useNavigate();
  const { deletePost } = usePosts();
  const {
    likesCount,
    hasLiked,
    comments,
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
  const [reportOpen, setReportOpen] = useState(false);
  const isOwner = user?.id === post.user_id;

  const authorName = post.profile ? (post.profile.display_name || 'User') : 'Private profile';

  const handleProfileClick = () => {
    if (!post.profile) return;
    navigate(`/profile/${post.user_id}`);
  };

  const handleShare = async () => {
    await shareLink({
      title: post.profile?.display_name || 'Check out this post',
      text: post.content || undefined,
      url: buildShareUrl.post(post.user_id, post.id),
    });
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
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="bg-card border border-border rounded-[2px] overflow-hidden"
    >
      {/* Header */}
      <header className="flex items-center justify-between p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <Avatar 
            className="w-11 h-11 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            onClick={handleProfileClick}
          >
            <AvatarImage src={post.profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground font-medium">
              {authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 
              className="text-sm font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={handleProfileClick}
            >
              {authorName}
            </h3>
            <time className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </time>
          </div>
        </div>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="iconSm" className="text-muted-foreground" aria-label="Post actions">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border/50">
              {isOwner && (
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete post
                </DropdownMenuItem>
              )}
              {!isOwner && (
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    setReportOpen(true);
                  }}
                  className="gap-2"
                >
                  <Flag className="w-4 h-4" />
                  Report
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetType="post"
          targetId={post.id}
        />
      </header>

      {/* Content */}
      {post.content && (
        <div className="px-4 sm:px-5 pb-3">
          <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        </div>
      )}

      {/* Media */}
      {post.media_url && post.media_type !== 'text' && (
        <div className="relative bg-muted/10 aspect-square">
          {post.media_type === 'video' ? (
            <div className="relative h-full">
              <video
                src={post.media_url}
                className="w-full h-full object-cover cursor-pointer"
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
                    className="absolute inset-0 flex items-center justify-center bg-background/30 pointer-events-none"
                  >
                    <div className="w-16 h-16 rounded-full glass-strong flex items-center justify-center">
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
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="px-3 sm:px-4 py-2 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleLike}
              disabled={!user || isLiking}
              aria-label={hasLiked ? "Unlike" : "Like"}
              className={`flex items-center justify-center min-h-11 min-w-11 ${
                hasLiked ? 'text-primary' : 'text-foreground'
              }`}
            >
              <Heart className={`w-6 h-6 ${hasLiked ? 'fill-primary' : ''}`} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowComments(!showComments)}
              aria-label="Comment"
              className="flex items-center justify-center min-h-11 min-w-11 text-foreground"
            >
              <MessageCircle className="w-6 h-6" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleShare}
              aria-label="Share"
              className="flex items-center justify-center min-h-11 min-w-11 text-foreground"
            >
              <Share2 className="w-6 h-6" />
            </motion.button>
          </div>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleSave}
            disabled={!user}
            aria-label={isSaved ? "Unsave" : "Save"}
            className={`flex items-center justify-center min-h-11 min-w-11 ${
              isSaved ? 'text-primary' : 'text-foreground'
            }`}
          >
            <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-primary' : ''}`} />
          </motion.button>
        </div>

        {isOwner && likesCount > 0 && (
          <p className="px-2 pb-2 text-xs text-muted-foreground">
            Only you can see this: {likesCount} {likesCount === 1 ? 'like' : 'likes'}
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
            className="px-4 sm:px-5 pb-4 border-t border-border/20"
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
