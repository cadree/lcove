import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal, Trash2, Play, Flag, Repeat2 } from 'lucide-react';
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
import { fileCode } from '@/lib/noviQuests';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { ShareSheet } from '@/components/share/ShareSheet';
import { useOwnPostViewCounts, useRecordPostView } from '@/hooks/usePostViews';
import { useMyReposts, useSharingActions } from '@/hooks/useSharing';
import { canRepostMedia, ownerOnlyInsight, repostedByLabel } from '@/lib/sharing';

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
  repost?: {
    id: string;
    user_id: string;
    created_at: string;
    profile?: { display_name: string | null; avatar_url: string | null } | null;
  } | null;
}

const FeedPost = ({ post, hero = false }: { post: Post; hero?: boolean }) => {
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
  const [shareOpen, setShareOpen] = useState(false);
  const isOwner = user?.id === post.user_id;
  const viewRef = useRecordPostView(post.id, post.user_id);
  const viewCounts = useOwnPostViewCounts(isOwner);
  const { postIds: myReposts } = useMyReposts();
  const { repostPost, undoRepost } = useSharingActions();
  const alreadyReposted = myReposts.has(post.id);
  const insight = ownerOnlyInsight(isOwner, viewCounts?.[post.id], likesCount);

  const authorName = post.profile ? (post.profile.display_name || 'User') : 'Private profile';

  const handleProfileClick = () => {
    if (!post.profile) return;
    navigate(`/profile/${post.user_id}`);
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
      ref={viewRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="file-panel overflow-hidden"
    >
      {!(post.media_url && post.media_type !== "text") && (
        <p className="mono-label px-4 pt-3 text-[8px] text-[hsl(var(--brand))]">{fileCode(post.id)}</p>
      )}
      {post.repost && (
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 px-4 pt-3 text-sm text-muted-foreground"
          onClick={() => navigate(`/profile/${post.repost?.user_id}`)}
        >
          <Repeat2 className="h-4 w-4" />
          {repostedByLabel(post.repost.profile?.display_name)}
        </button>
      )}
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
              {!isOwner && canRepostMedia(post.media_type, post.user_id, user?.id) && (
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => {
                    if (alreadyReposted) undoRepost.mutate(post.id);
                    else repostPost.mutate(post.id);
                  }}
                >
                  <Repeat2 className="w-4 h-4" />
                  {alreadyReposted ? 'Undo repost' : 'Repost'}
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
        <div className={`relative bg-muted/10 ${hero ? "aspect-[3/4]" : "aspect-square"}`}>
          <span className="mono-label absolute left-3 top-3 z-[1] rounded-full bg-black/55 px-2 py-1 text-[8px] text-white">
            {fileCode(post.id)}
          </span>
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
      <div className="grid grid-cols-4 border-t border-border">
        <div className="contents">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleLike}
              disabled={!user || isLiking}
              aria-label={hasLiked ? "Unlike" : "Like"}
              className={`mono-label flex min-h-11 flex-col items-center justify-center gap-0.5 text-[8px] ${
                hasLiked ? 'text-primary' : 'text-foreground'
              }`}
            >
              <Heart className={`h-4 w-4 ${hasLiked ? 'fill-primary' : ''}`} />
              {likesCount}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowComments(!showComments)}
              aria-label="Comment"
              className="mono-label flex min-h-11 flex-col items-center justify-center gap-0.5 text-[8px] text-foreground"
            >
              <MessageCircle className="h-4 w-4" />
              Note
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShareOpen(true)}
              aria-label="Share"
              className="mono-label flex min-h-11 flex-col items-center justify-center gap-0.5 text-[8px] text-foreground"
            >
              <Share2 className="h-4 w-4" />
              Send
            </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleSave}
            disabled={!user}
            aria-label={isSaved ? "Unsave" : "Save"}
            className={`mono-label flex min-h-11 flex-col items-center justify-center gap-0.5 text-[8px] ${
              isSaved ? 'text-primary' : 'text-foreground'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-primary' : ''}`} />
            File
          </motion.button>
        </div>
      </div>
      {insight && (
        <p className="px-4 pb-2 text-xs text-muted-foreground">{insight}</p>
      )}

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
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        target={{
          kind: 'post',
          post: {
            id: post.id,
            user_id: post.user_id,
            content: post.content,
            media_url: post.media_url,
            media_type: post.media_type,
            profile: post.profile,
          },
        }}
      />
    </motion.article>
  );
};

export default FeedPost;
