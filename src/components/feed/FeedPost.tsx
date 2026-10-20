import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal, Trash2, Flag } from 'lucide-react';
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
import { buildShareUrl } from '@/lib/shareLink';
import { ShareSheet } from '@/components/messages/ShareSheet';
import { fileCode } from '@/lib/noviQuests';
import { ReportDialog } from '@/components/safety/ReportDialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

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
  const [lightbox, setLightbox] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const isOwner = user?.id === post.user_id;

  const authorName = post.profile ? (post.profile.display_name || 'User') : 'Private profile';

  const handleProfileClick = () => {
    if (!post.profile) return;
    navigate(`/profile/${post.user_id}`);
  };

  const shareCard = {
    kind: "post" as const,
    id: post.id,
    userId: post.user_id,
    title: authorName,
    subtitle: post.content?.slice(0, 140) || undefined,
    mediaUrl: post.media_url,
    mediaType: post.media_type,
    href: `/profile/${post.user_id}`,
  };

  const handleDelete = () => {
    deletePost.mutate(post.id);
  };

  const toggleVideo = (e: React.MouseEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.paused) video.play();
    else video.pause();
  };

  return (
    <>
      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        card={shareCard}
        linkUrl={buildShareUrl.post(post.user_id, post.id)}
      />
      <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="file-panel overflow-hidden"
    >
      {!(post.media_url && post.media_type !== "text") && (
        <p className="mono-label px-4 pt-3 text-[8px] text-[hsl(var(--brand))]">{fileCode(post.id)}</p>
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
        <div className="mx-auto w-full max-w-[470px] bg-muted/15">
          <button
            type="button"
            className="relative block w-full"
            onClick={() => setLightbox(true)}
            aria-label="View full size"
          >
            <span className="mono-label absolute left-3 top-3 z-[1] rounded-full bg-black/55 px-2 py-1 text-[8px] text-white">
              {fileCode(post.id)}
            </span>
            <span className="relative mx-auto block aspect-[4/5] w-full overflow-hidden bg-black">
              {post.media_type === 'video' ? (
                <video
                  src={post.media_url}
                  className="absolute inset-0 h-full w-full object-contain"
                  playsInline
                  muted
                  loop
                />
              ) : (
                <img
                  src={post.media_url}
                  alt=""
                  className="absolute inset-0 h-full w-full bg-muted object-contain"
                  loading="lazy"
                />
              )}
            </span>
          </button>
          <Dialog open={lightbox} onOpenChange={setLightbox}>
            <DialogContent className="max-w-[min(100vw-1.5rem,720px)] border-border bg-background p-3">
              <DialogTitle className="sr-only">Full size media</DialogTitle>
              {post.media_type === 'video' ? (
                <video src={post.media_url} className="max-h-[80vh] w-full object-contain" controls playsInline onClick={toggleVideo} />
              ) : (
                <img src={post.media_url} alt="" className="max-h-[80vh] w-full object-contain" />
              )}
            </DialogContent>
          </Dialog>
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
      {isOwner && likesCount > 0 && (
        <p className="px-4 pb-2 text-xs text-muted-foreground">
          Only you can see this: {likesCount} {likesCount === 1 ? 'like' : 'likes'}
        </p>
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
    </motion.article>
    </>
  );
};

export default FeedPost;
