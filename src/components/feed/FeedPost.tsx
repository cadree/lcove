import { useState } from 'react';
import { RepostComposer } from '@/components/share/RepostComposer';
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
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Bookmark, Share2, MoreHorizontal, Trash2, Flag, Repeat2, Play, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { useFeedCardState } from '@/hooks/feedCardState';
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
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ShareSheet } from '@/components/share/ShareSheet';
import { useOwnPostViewCounts, useRecordPostView } from '@/hooks/usePostViews';
import { useMyReposts, useSharingActions } from '@/hooks/useSharing';
import { canRepostMedia, ownerOnlyInsight, repostedByLabel } from '@/lib/sharing';
import { EmbedPlayer } from '@/components/feed/EmbedPlayer';
import { embedFromPost, type StoredEmbedFields } from '@/lib/videoEmbed';
import { FeedVideo } from '@/components/media/FeedVideo';
import { UploadingBadge } from '@/components/uploads/UploadingBadge';

interface Post extends StoredEmbedFields {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: 'photo' | 'video' | 'text' | null;
  thumbnail_url?: string | null;
  created_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  repost?: {
    id: string;
    user_id: string;
    created_at: string;
    caption?: string | null;
    profile?: { display_name: string | null; avatar_url: string | null } | null;
  } | null;
  upload_job_id?: string;
}

const FeedPost = ({ post }: { post: Post }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { deletePost } = usePosts();
  const [showComments, setShowComments] = useState(false);
  const {
    likesCount,
    hasLiked,
    isSaved,
    toggleLike,
    toggleSave,
    isLiking,
  } = useFeedCardState(post.id);
  const {
    comments,
    addComment,
    deleteComment,
    isCommenting,
  } = usePostInteractions(post.id, { threadOnly: true, loadComments: showComments });
  const [lightbox, setLightbox] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const isOwner = user?.id === post.user_id;
  const viewRef = useRecordPostView(post.id, post.user_id);
  const viewCounts = useOwnPostViewCounts(isOwner);
  const { postIds: myReposts } = useMyReposts();
  const { repostPost, undoRepost } = useSharingActions();
  const alreadyReposted = myReposts.has(post.id);
  const insight = ownerOnlyInsight(isOwner, viewCounts?.[post.id], likesCount);
  const embed = embedFromPost(post);

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
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
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
      {post.repost?.caption && (
        <p className="px-4 pb-1 text-sm text-foreground">{post.repost.caption}</p>
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
                  onSelect={(event) => {
                    event.preventDefault();
                    setConfirmDelete(true);
                  }}
                  className="text-destructive focus:text-destructive gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete post
                </DropdownMenuItem>
              )}
              {!isOwner && canRepostMedia(post.media_type, post.user_id, user?.id) && (
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={(event) => {
                    event.preventDefault();
                    if (alreadyReposted) undoRepost.mutate(post.id);
                    else setRepostOpen(true);
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
      {embed ? (
        <div className="relative mx-auto w-full max-w-[470px] bg-black">
          <span className="mono-label absolute left-3 top-3 z-[1] rounded-full bg-black/55 px-2 py-1 text-[8px] text-white">
            {fileCode(post.id)}
          </span>
          <EmbedPlayer embed={embed} title={post.embed_title} />
        </div>
      ) : post.media_url && post.media_type !== 'text' && (
        <div className="mx-auto w-full max-w-[470px] bg-muted/15">
          {post.media_type === 'video' ? (
            <div className="relative mx-auto block aspect-[4/5] w-full overflow-hidden bg-black">
              <span className="mono-label pointer-events-none absolute left-3 top-3 z-[1] rounded-full bg-black/55 px-2 py-1 text-[8px] text-white">
                {fileCode(post.id)}
              </span>
              {post.upload_job_id && <UploadingBadge jobId={post.upload_job_id} />}
              {/* Plays muted in place while on screen; a tap plays or pauses it right here. */}
              <FeedVideo
                src={post.media_url}
                poster={post.thumbnail_url ?? undefined}
                frameAt={1}
                playWhenVisible
                muted={muted}
                onClick={toggleVideo}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                aria-label={playing ? 'Pause video' : 'Play video'}
                className="absolute inset-0 h-full w-full cursor-pointer object-contain"
              />
              {!playing && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center" data-testid="feed-video-paused">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white">
                    <Play className="ml-0.5 h-6 w-6 fill-current" />
                  </span>
                </span>
              )}
              <button
                type="button"
                className="absolute right-2 top-2 z-[2] flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white"
                onClick={(event) => {
                  event.currentTarget.parentElement?.querySelector('video')?.pause();
                  setLightbox(true);
                }}
                aria-label="View full size"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="absolute bottom-2 right-2 z-[2] flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white"
                onClick={() => setMuted((value) => !value)}
                aria-label={muted ? 'Turn sound on' : 'Mute'}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          ) : (
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
                {post.upload_job_id && <UploadingBadge jobId={post.upload_job_id} />}
                <img
                  src={post.media_url}
                  alt=""
                  className="absolute inset-0 h-full w-full bg-muted object-contain"
                  loading="lazy"
                />
              </span>
            </button>
          )}
          <Dialog open={lightbox} onOpenChange={setLightbox}>
            {/* pt-14 keeps the media below the close X, so the video's own mute control can't cover it. */}
            <DialogContent className="max-w-[min(100vw-1.5rem,720px)] border-border bg-background p-3 pt-14">
              <DialogTitle className="sr-only">Full size media</DialogTitle>
              <DialogDescription className="sr-only">The post photo or video at full size</DialogDescription>
              {post.media_type === 'video' ? (
                <video src={post.media_url} className="max-h-[80vh] w-full object-contain" controls playsInline autoPlay />
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
              onClick={() => toggleLike({
                id: post.id,
                user_id: post.user_id,
                content: post.content,
                media_url: post.media_url,
                media_type: post.media_type,
              })}
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
            onClick={() => toggleSave(post.id)}
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
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>This removes the post. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <RepostComposer
        open={repostOpen}
        onOpenChange={setRepostOpen}
        pending={repostPost.isPending}
        onSubmit={async (caption) => {
          await repostPost.mutateAsync({ postId: post.id, caption });
        }}
      />
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
