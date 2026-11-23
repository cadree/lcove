import { FeedVideo } from "@/components/media/FeedVideo";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, Play } from "lucide-react";
import FeedPost from "@/components/feed/FeedPost";
import { usePosts } from "@/hooks/usePosts";
import { FeedEngagementProvider } from "@/hooks/useFeedEngagement";
import { ReelViewer } from "@/components/explore/ReelViewer";
import { browsePosts, collectReels, growVisibleCount, matchesBrowseQuery } from "@/lib/exploreBrowse";

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
          // Tiles show a still frame; tapping one opens the full-screen viewer.
          <div className="grid grid-cols-2 gap-2">
            {shownReels.map((reel, index) => (
              <button
                key={reel.id}
                type="button"
                data-testid="reel-tile"
                onClick={() => setOpenReel(index)}
                aria-label={`Watch reel by ${reel.name}`}
                className="relative aspect-[9/16] overflow-hidden rounded-[14px] bg-black text-left"
              >
                <FeedVideo src={reel.mediaUrl} className="h-full w-full object-cover" frameAt={1} />
                <Play className="absolute right-2 top-2 h-5 w-5 fill-white text-white drop-shadow" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 px-3 pb-2 pt-6 font-body text-xs font-extrabold text-white">
                  {reel.name}
                </span>
              </button>
            ))}
            {heading === undefined && <div ref={sentinel} className="col-span-2 h-1" />}
          </div>
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

function EmptyCopy({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="file-panel px-4 py-8 text-center">
      <p className="ether-title text-[22px] text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
