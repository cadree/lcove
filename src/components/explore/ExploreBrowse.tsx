import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import FeedPost from "@/components/feed/FeedPost";
import { usePosts } from "@/hooks/usePosts";
import { useStories } from "@/hooks/useStories";
import { browsePosts, collectReels, growVisibleCount, matchesBrowseQuery } from "@/lib/exploreBrowse";

const PAGE = 4;
type Lane = "reels" | "posts" | "portfolios";

const lanes: { id: Lane; label: string }[] = [
  { id: "reels", label: "Reels" },
  { id: "posts", label: "Posts" },
  { id: "portfolios", label: "Portfolios" },
];

export function ExploreBrowse({ query }: { query: string }) {
  const [lane, setLane] = useState<Lane>("reels");
  const [visible, setVisible] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  const { posts, isLoading: postsLoading } = usePosts();
  const { stories, isLoading: storiesLoading } = useStories();

  const reels = useMemo(() => {
    return collectReels(stories, posts).filter((reel) => matchesBrowseQuery(reel.name, "", query));
  }, [stories, posts, query]);

  const lanePosts = useMemo(() => {
    const selected = browsePosts(posts, lane === "portfolios" ? "portfolios" : "posts");
    return selected.filter((post) => matchesBrowseQuery(post.profile?.display_name, post.content, query));
  }, [posts, lane, query]);

  const total = lane === "reels" ? reels.length : lanePosts.length;
  const shownReels = reels.length === 0 ? [] : Array.from({ length: Math.ceil(visible / Math.max(reels.length, 1)) }, (_, loop) =>
    reels.map((reel) => ({ ...reel, key: `${reel.id}-${loop}` })),
  ).flat().slice(0, Math.max(visible, Math.min(PAGE, reels.length)));
  const shownPosts = lanePosts.slice(0, visible);

  useEffect(() => {
    setVisible(PAGE);
  }, [lane, query]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || total === 0) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible((current) => growVisibleCount(current, total, PAGE));
      }
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [total, lane, visible]);

  const loading = postsLoading || storiesLoading;

  return (
    <section aria-label="Browse" className="min-w-0">
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
          <EmptyCopy title="No reels yet" detail="Video stories and video posts from other people show up here." />
        ) : (
          <div className="h-[calc(100dvh-13.5rem)] min-h-[28rem] snap-y snap-mandatory overflow-y-auto rounded-[18px] bg-black">
            {shownReels.map((reel) => (
              <article key={reel.key} className="relative h-full min-h-full snap-start">
                <video
                  src={reel.mediaUrl}
                  className="h-full w-full object-contain"
                  playsInline
                  muted
                  loop
                  autoPlay
                />
                <Link
                  to={`/profile/${reel.userId}`}
                  className="absolute inset-x-3 bottom-4 flex min-h-11 items-center justify-between rounded-full bg-background/90 px-4 text-foreground"
                >
                  <span className="truncate font-body text-sm font-extrabold">{reel.name}</span>
                  <span className="mono-label shrink-0 text-[9px] text-muted-foreground">Profile</span>
                </Link>
              </article>
            ))}
            <div ref={sentinel} className="h-1" />
          </div>
        )
      ) : shownPosts.length === 0 ? (
        <EmptyCopy
          title={lane === "portfolios" ? "No portfolios yet" : "No posts yet"}
          detail={lane === "portfolios" ? "Portfolio posts open the creator's profile." : "Posts from the feed open the creator's profile."}
        />
      ) : (
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
      )}
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
