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
import { useQueryClient } from '@tanstack/react-query';
import { compactCount } from '@/lib/feedEngagement';
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
    commentCount,
    reactors,
  } = useFeedCardState(post.id);
  const queryClient = useQueryClient();
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

  const hasMedia = !!embed || (!!post.media_url && post.media_type !== 'text');
  const when = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const likeTarget = {
    id: post.id,
    user_id: post.user_id,
    content: post.content,
    media_url: post.media_url,
    media_type: post.media_type,
  };
  const avatar = (size: string) => (
    <Avatar className={`${size} shrink-0 cursor-pointer`} onClick={handleProfileClick}>
      <AvatarImage src={post.profile?.avatar_url || undefined} />
      <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
        {authorName.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
  const menu = user && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="iconSm"
          className={hasMedia ? 'h-11 w-11 rounded-full bg-black/35 text-white backdrop-blur-md hover:bg-black/50 hover:text-white' : 'text-muted-foreground'}
          aria-label="Post actions"
        >
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
  );
  const countsPill = (
    <div className={`flex items-center rounded-full ${hasMedia ? 'border border-white/20 bg-black/35 text-white backdrop-blur-md' : 'bg-muted text-foreground'}`}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => toggleLike(likeTarget)}
        disabled={!user || isLiking}
        aria-label={hasLiked ? `Unlike (${likesCount} likes)` : `Like (${likesCount} likes)`}
        aria-pressed={hasLiked}
        className="flex min-h-11 items-center gap-1.5 pl-3.5 pr-2 text-[13px] font-semibold"
      >
        <Heart className={`h-4 w-4 ${hasLiked ? 'fill-[#ff5d8f] text-[#ff5d8f]' : ''}`} />
        {compactCount(likesCount)}
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowComments(!showComments)}
        aria-label={`Comments (${commentCount})`}
        aria-expanded={showComments}
        className="flex min-h-11 items-center gap-1.5 pl-2 pr-3.5 text-[13px] font-semibold"
      >
        <MessageCircle className="h-4 w-4" />
        {compactCount(commentCount)}
      </motion.button>
    </div>
  );
  const reactorFaces = reactors.length > 0 && (
    <ul className="flex flex-col items-end gap-1.5" aria-label={`Liked by ${reactors.map((r) => r.name).join(", ")}`}>
      {reactors.map((r, i) => (
        <li key={r.id} className={`relative ${i % 2 ? 'mr-5' : ''}`}>
          <span className="block h-9 w-9 overflow-hidden rounded-full border-2 border-white/90 bg-muted shadow-md">
            {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full items-center justify-center text-xs text-muted-foreground">{r.name.charAt(0)}</span>}
          </span>
          <Heart aria-hidden className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-[#ff5d8f] text-[#ff5d8f] drop-shadow" />
        </li>
      ))}
    </ul>
  );
  const authorChip = (
    <button
      type="button"
      onClick={handleProfileClick}
      className="flex min-h-11 max-w-[70%] items-center gap-2 rounded-full border border-white/20 bg-black/35 py-1 pl-1 pr-3.5 text-left text-white backdrop-blur-md"
    >
      <span className="block h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/20">
        {post.profile?.avatar_url ? <img src={post.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs">{authorName.charAt(0).toUpperCase()}</span>}
      </span>
      <span className="truncate text-[13px] font-semibold">{authorName}</span>
    </button>
  );

  return (
    <motion.article
      ref={viewRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-2"
      aria-label={`Post by ${authorName}`}
    >
      {post.repost && (
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 px-2 text-sm text-muted-foreground"
          onClick={() => navigate(`/profile/${post.repost?.user_id}`)}
        >
          <Repeat2 className="h-4 w-4" />
          {repostedByLabel(post.repost.profile?.display_name)}
        </button>
      )}
      {post.repost?.caption && (
        <p className="px-2 pb-1 text-sm text-foreground">{post.repost.caption}</p>
      )}
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="post" targetId={post.id} />

      {/* Media card: the author on the photo, counts in a glass pill, recent likers on the right. */}
      {embed ? (
        <div className="overflow-hidden rounded-[28px] border border-border bg-black shadow-[0_18px_40px_-24px_rgba(0,0,0,.6)]">
          <div className="flex items-center justify-between gap-2 p-2">
            {authorChip}
            {menu}
          </div>
          <EmbedPlayer embed={embed} title={post.embed_title} />
          <div className="flex items-center justify-between gap-2 p-2">
            {countsPill}
            <span className="mono-label pr-2 text-[8px] text-white/60">{fileCode(post.id)}</span>
          </div>
        </div>
      ) : post.media_url && post.media_type !== 'text' && (
        <div className="relative mx-auto w-full overflow-hidden rounded-[28px] border border-border bg-black shadow-[0_18px_40px_-24px_rgba(0,0,0,.6)]">
          {post.media_type === 'video' ? (
            <div className="relative mx-auto block aspect-[4/5] w-full overflow-hidden bg-black">
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
                className="absolute inset-0 h-full w-full cursor-pointer object-cover"
              />
              {!playing && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center" data-testid="feed-video-paused">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md">
                    <Play className="ml-0.5 h-6 w-6 fill-current" />
                  </span>
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="relative block w-full"
              onClick={() => setLightbox(true)}
              aria-label="View full size"
            >
              <span className="relative mx-auto block aspect-[4/5] w-full overflow-hidden bg-black">
                {post.upload_job_id && <UploadingBadge jobId={post.upload_job_id} />}
                <img
                  src={post.media_url}
                  alt=""
                  className="absolute inset-0 h-full w-full bg-muted object-cover"
                  loading="lazy"
                />
              </span>
            </button>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 to-transparent" />
          <div className="absolute left-3 right-3 top-3 z-[2] flex items-start justify-between gap-2">
            {authorChip}
            <div className="flex flex-col items-end gap-2">
              {menu}
              {post.media_type === 'video' && (
                <>
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md"
                    onClick={(event) => {
                      event.currentTarget.closest('.relative')?.querySelector('video')?.pause();
                      setLightbox(true);
                    }}
                    aria-label="View full size"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md"
                    onClick={() => setMuted((value) => !value)}
                    aria-label={muted ? 'Turn sound on' : 'Mute'}
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="absolute bottom-3 left-3 right-3 z-[2] flex items-end justify-between gap-2">
            {countsPill}
            {reactorFaces}
          </div>
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

      {/* Caption card: its own rounded card under the media so the words stand out. */}
      <div className="overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_10px_30px_-22px_rgba(0,0,0,.5)]">
        <div className="flex gap-3 px-4 pb-2 pt-3.5">
          {avatar('h-9 w-9')}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-[14px] leading-tight">
                <button type="button" onClick={handleProfileClick} className="font-semibold text-foreground hover:text-primary">
                  {authorName}
                </button>
                <time className="ml-2 text-xs text-muted-foreground">{when}</time>
              </p>
              {!hasMedia && menu}
            </div>
            {post.content ? (
              <p className={`mt-1 whitespace-pre-wrap leading-relaxed text-foreground/90 ${hasMedia ? 'text-[14px]' : 'text-[16px]'}`}>
                {post.content}
              </p>
            ) : !hasMedia ? null : (
              <p className="mt-1 text-[13px] text-muted-foreground">No caption</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 pb-1.5">
          {!hasMedia && countsPill}
          <span className="flex-1" />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShareOpen(true)}
            aria-label="Share"
            className="mono-label flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[9px] text-muted-foreground hover:text-foreground"
          >
            <Share2 className="h-4 w-4" />
            Send
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => toggleSave(post.id)}
            disabled={!user}
            aria-label={isSaved ? "Unsave" : "Save"}
            className={`mono-label flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[9px] ${isSaved ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-primary' : ''}`} />
            File
          </motion.button>
        </div>
        {insight && (
          <p className="px-4 pb-2 text-xs text-muted-foreground">{insight}</p>
        )}

        {/* Comments Section */}
        <Collapsible open={showComments} onOpenChange={setShowComments}>
          <CollapsibleContent>
            <div className="border-t border-border/40 px-4 pb-4 sm:px-5">
              <CommentThread
                comments={comments}
                onAddComment={async (content: string, parentId?: string) => {
                  await addComment(content, parentId);
                  void queryClient.invalidateQueries({ queryKey: ['feed-comment-counts'] });
                }}
                onDeleteComment={deleteComment}
                isCommenting={isCommenting}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
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
