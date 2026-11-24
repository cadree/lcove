import { FeedVideo } from "@/components/media/FeedVideo";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Heart, Loader2, MessageCircle, Play } from "lucide-react";
import { useFeedCardState } from "@/hooks/feedCardState";
import { compactCount } from "@/lib/feedEngagement";
import FeedPost from "@/components/feed/FeedPost";
import { usePosts } from "@/hooks/usePosts";
import { FeedEngagementProvider } from "@/hooks/useFeedEngagement";
import { ReelViewer } from "@/components/explore/ReelViewer";
import { browsePosts, collectReels, growVisibleCount, matchesBrowseQuery, type BrowseReel } from "@/lib/exploreBrowse";

const PAGE = 6;
type Lane = "reels" | "posts" | "portfolios";

const lanes: { id: Lane; label: string }[] = [
  { id: "reels", label: "Reels" },
  { id: "posts", label: "Posts" },
  { id: "portfolios", label: "Portfolios" },
];

/** With `heading` (Explore > For you) the whole block hides when there is nothing to browse. */
export function ExploreBrowse({ query, heading }: { query: string; heading?: ReactNode }) {
  const [lane, setLane] = useState<Lane>("reels");
  const [visible, setVisible] = useState(PAGE);
  const [openReel, setOpenReel] = useState<number | null>(null);
  const closeReel = useCallback(() => setOpenReel(null), []);
  const sentinel = useRef<HTMLDivElement>(null);
  const { posts, isLoading: postsLoading } = usePosts();

  // Reels are video posts. Stories stay in the story tray and expire there.
  const reels = useMemo(() => {
    return collectReels(posts).filter((reel) => matchesBrowseQuery(reel.name, "", query));
  }, [posts, query]);

  const lanePosts = useMemo(() => {
    const selected = browsePosts(posts, lane === "portfolios" ? "portfolios" : "posts");
    return selected.filter((post) => matchesBrowseQuery(post.profile?.display_name, post.content, query));
  }, [posts, lane, query]);

  const total = lane === "reels" ? reels.length : lanePosts.length;
  // On For you the reels stay one short grid so the Mall below is still in reach; See all has the rest.
  const shownReels = reels.slice(0, heading === undefined ? visible : PAGE);
  const shownPosts = lanePosts.slice(0, visible);
  const atEnd = total > 0 && visible >= total;

  useEffect(() => {
    setVisible(PAGE);
  }, [lane, query]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || total === 0 || visible >= total) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible((current) => growVisibleCount(current, total, PAGE));
      }
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [total, lane, visible]);

  const loading = postsLoading;
  const empty = !loading && reels.length === 0 && browsePosts(posts, "posts").length === 0 && browsePosts(posts, "portfolios").length === 0;
  if (heading !== undefined && empty) return null;

  return (
    <section aria-label="Browse" className="min-w-0">
      {heading}
      <div className="mb-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {lanes.map((item) => {
          const active = lane === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setLane(item.id)}
              className={`mono-label inline-flex h-11 shrink-0 items-center rounded-full border px-3 text-[11px] ${
                active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground"
              }`}
              aria-pressed={active}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : lane === "reels" ? (
        reels.length === 0 ? (
          <EmptyCopy title="No reels yet" detail="Video posts from other people show up here." />
        ) : (
          // Tiles show a still frame; tapping one opens the full-screen viewer. Each tile is a
          // rounded media card with the author on it and the caption in its own card below.
          <FeedEngagementProvider postIds={shownReels.map((reel) => reel.postId ?? "")}>
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
            {shownReels.map((reel, index) => (
              <ReelTile key={reel.id} reel={reel} onOpen={() => setOpenReel(index)} />
            ))}
            {heading === undefined && <div ref={sentinel} className="col-span-2 h-1" />}
          </div>
          </FeedEngagementProvider>
        )
      ) : shownPosts.length === 0 ? (
        <EmptyCopy
          title={lane === "portfolios" ? "No portfolios yet" : "No posts yet"}
          detail={lane === "portfolios" ? "Portfolio posts open the creator's profile." : "Posts from the feed open the creator's profile."}
        />
      ) : (
        // FeedPost reads likes and saves from this provider; without it the lane threw.
        <FeedEngagementProvider postIds={shownPosts.map((post) => post.id)}>
        <div className="space-y-4">
          {shownPosts.map((post) => (
            <div key={post.id}>
              <FeedPost post={post} />
              <Link
                to={`/profile/${post.user_id}`}
                className="mono-label mt-1 inline-flex min-h-11 items-center text-[10px] text-muted-foreground"
              >
                Open {post.profile?.display_name || "profile"}
              </Link>
            </div>
          ))}
          <div ref={sentinel} className="h-1" />
        </div>
        </FeedEngagementProvider>
      )}
      {!loading && atEnd && heading === undefined && <p className="mono-label py-6 text-center text-[10px] text-muted-foreground">You're all caught up</p>}
      {openReel !== null && <ReelViewer reels={reels} start={openReel} onClose={closeReel} />}
    </section>
  );
}

function ReelTile({ reel, onOpen }: { reel: BrowseReel; onOpen: () => void }) {
  const { likesCount, commentCount } = useFeedCardState(reel.postId ?? "");
  return (
    <div className="min-w-0 space-y-1.5">
      <button
        type="button"
        data-testid="reel-tile"
        onClick={onOpen}
        aria-label={`Watch reel by ${reel.name}`}
        className="relative block aspect-[9/16] w-full overflow-hidden rounded-[22px] border border-border bg-black text-left shadow-[0_14px_30px_-20px_rgba(0,0,0,.7)]"
      >
        <FeedVideo src={reel.mediaUrl} className="h-full w-full object-cover" frameAt={1} />
        <span className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
        <span className="absolute left-2 top-2 flex max-w-[calc(100%-3rem)] items-center gap-1.5 rounded-full border border-white/20 bg-black/35 py-0.5 pl-0.5 pr-2.5 text-white backdrop-blur-md">
          <span className="block h-6 w-6 shrink-0 overflow-hidden rounded-full bg-white/20">
            {reel.avatarUrl ? <img src={reel.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full items-center justify-center text-[10px]">{reel.name.charAt(0)}</span>}
          </span>
          <span className="truncate font-body text-[11px] font-extrabold">{reel.name}</span>
        </span>
        <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/35 backdrop-blur-md">
          <Play className="ml-0.5 h-3.5 w-3.5 fill-white text-white" />
        </span>
        <span className="absolute bottom-2 left-2 flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" aria-hidden />{compactCount(likesCount)}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" aria-hidden />{compactCount(commentCount)}</span>
        </span>
      </button>
      {reel.caption && (
        <p className="line-clamp-2 rounded-[16px] border border-border bg-card px-3 py-2 text-[12px] leading-snug text-foreground/90">{reel.caption}</p>
      )}
    </div>
  );
}

function EmptyCopy({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="file-panel px-4 py-8 text-center">
      <p className="ether-title text-[22px] text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
