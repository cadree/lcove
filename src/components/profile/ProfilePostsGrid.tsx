import { FeedVideo } from "@/components/media/FeedVideo";
import { motion } from "framer-motion";
import { Play, ImageIcon, Repeat2, Eye, Heart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ProfilePost } from "@/types/post";
import { profilePostSegments } from "@/lib/profilePosts";
import { useOwnPostViewCounts } from "@/hooks/usePostViews";
import { gridViewCount } from "@/lib/sharing";
import { EmbedThumbnail } from "@/components/feed/EmbedPlayer";
import { embedFromPost } from "@/lib/videoEmbed";
import { useCoverBackfill } from "@/hooks/useCoverBackfill";
import { usePostInteractions } from "@/hooks/usePostInteractions";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { compactCount } from "@/lib/feedEngagement";

interface ProfilePostsGridProps {
  posts: ProfilePost[];
  onPostClick: (post: ProfilePost) => void;
  isLoading?: boolean;
  isOwner?: boolean;
}

export function ProfilePostsGrid({ posts, onPostClick, isLoading, isOwner = false }: ProfilePostsGridProps) {
  const segments = profilePostSegments(posts);
  const viewCounts = useOwnPostViewCounts(isOwner);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
          <ImageIcon className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h3 className="text-xl font-medium text-foreground mb-2">
          {isOwner ? "Share a post" : "No posts yet"}
        </h3>
        <p className="text-muted-foreground text-sm max-w-[250px]">
          {isOwner
            ? "When you share a post, it will appear on your profile."
            : "Nothing has been shared on this profile yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="profile-posts">
      {segments.map((segment) => {
        if (segment.type === "text") {
          const views = gridViewCount(isOwner && segment.post.user_id !== undefined && !segment.post.repost, viewCounts, segment.post.id);
          return (
            <ProfileTextPostCard
              key={segment.post.grid_key ?? segment.post.id}
              post={segment.post}
              views={views}
              onPostClick={onPostClick}
            />
          );
        }
        return (
          <div key={segment.posts[0]?.grid_key ?? segment.posts[0]?.id} className="grid grid-cols-3 gap-1" data-testid="profile-media-grid">
            {segment.posts.map((post, index) => {
              const views = gridViewCount(isOwner && post.user_id !== undefined && !post.repost, viewCounts, post.id);
              return (
                <MediaTile
                  key={post.grid_key ?? post.id}
                  post={post}
                  index={index}
                  views={views}
                  isOwner={isOwner}
                  onPostClick={onPostClick}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ProfileTextPostCard({
  post,
  views,
  onPostClick,
}: {
  post: ProfilePost;
  views: number | null;
  onPostClick: (post: ProfilePost) => void;
}) {
  const { user } = useAuth();
  const { likesCount, hasLiked, toggleLike, isLiking } = usePostInteractions(post.id, { loadComments: false });
  const authorName = post.profile?.display_name || "User";
  const when = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  return (
    <article
      data-testid="profile-text-card"
      className="profile-text-post cursor-pointer overflow-hidden rounded-[24px] border border-border bg-card text-left shadow-[0_10px_30px_-22px_rgba(0,0,0,.5)]"
      onClick={() => onPostClick(post)}
    >
      {post.repost && (
        <p className="flex items-center gap-2 px-4 pt-3 text-sm text-muted-foreground">
          <Repeat2 className="h-4 w-4" />
          Repost
        </p>
      )}
      <div className="flex gap-3 px-4 pb-2 pt-3.5">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={post.profile?.avatar_url || undefined} alt="" />
          <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
            {authorName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="min-w-0 text-[14px] leading-tight">
            <span className="font-semibold text-foreground">{authorName}</span>
            <time className="ml-2 text-xs text-muted-foreground" dateTime={post.created_at}>{when}</time>
          </p>
          {post.content ? (
            <p className="mt-1 whitespace-pre-wrap text-[16px] leading-relaxed text-foreground/90">{post.content}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1 px-2 pb-1.5">
        <div className="flex items-center rounded-full bg-muted text-foreground">
          <button
            type="button"
            className="flex min-h-11 items-center gap-1.5 pl-3.5 pr-3.5 text-[13px] font-semibold"
            aria-label={hasLiked ? `Unlike (${likesCount} likes)` : `Like (${likesCount} likes)`}
            aria-pressed={hasLiked}
            disabled={!user || isLiking}
            onClick={(event) => {
              event.stopPropagation();
              toggleLike();
            }}
          >
            <Heart className={`h-4 w-4 ${hasLiked ? "fill-[#ff5d8f] text-[#ff5d8f]" : ""}`} />
            {compactCount(likesCount)}
          </button>
        </div>
        {views != null && (
          <span className="ml-1 flex items-center gap-1 px-2 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            {views}
          </span>
        )}
      </div>
    </article>
  );
}

function MediaTile({
  post,
  index,
  views,
  isOwner,
  onPostClick,
}: {
  post: ProfilePost;
  index: number;
  views: number | null;
  isOwner: boolean;
  onPostClick: (post: ProfilePost) => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="aspect-square relative group overflow-hidden bg-muted"
      onClick={() => onPostClick(post)}
    >
      {embedFromPost(post) ? (
        <>
          <EmbedThumbnail
            embed={embedFromPost(post)!}
            thumbnailUrl={post.embed_thumbnail_url}
            title={post.embed_title || post.content}
          />
          <div className="absolute top-2 right-2">
            <Play className="w-4 h-4 text-white drop-shadow-lg" fill="white" />
          </div>
        </>
      ) : post.media_url && post.media_type === "video" ? (
        <>
          <VideoTile post={post} ownerId={isOwner ? post.user_id : undefined} />
          <div className="absolute top-2 right-2">
            <Play className="w-4 h-4 text-white drop-shadow-lg" fill="white" />
          </div>
        </>
      ) : (
        <img
          src={post.media_url ?? undefined}
          alt={post.content || "Post"}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}
      {post.repost && (
        <span className="absolute left-1 top-1 rounded-[2px] bg-background/80 p-1 text-foreground">
          <Repeat2 className="h-3.5 w-3.5" />
        </span>
      )}
      {views != null && (
        <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded-[2px] bg-background/80 px-1 py-0.5 text-[10px] text-foreground">
          <Eye className="h-3 w-3" />
          {views}
        </span>
      )}
    </motion.button>
  );
}

/** Saved cover when there is one; otherwise a frame 1s in (frame 0 is often black). */
function VideoTile({ post, ownerId }: { post: ProfilePost; ownerId?: string }) {
  const backfilled = useCoverBackfill(post, post.repost ? undefined : ownerId);
  const cover = post.thumbnail_url || backfilled;
  if (cover) return <img src={cover} alt={post.content || "Video"} className="h-full w-full object-cover" loading="lazy" />;
  return <FeedVideo src={post.media_url} className="h-full w-full object-cover" loop={false} frameAt={1} />;
}
