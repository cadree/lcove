import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import { useFavorites } from "@/hooks/useFavorites";
import { useFriendProfiles } from "@/hooks/useFriendProfiles";

/**
 * ProfileFriendsSection
 * - Renders a Friends section on /profile
 * - Handles loading states without flashing "0"
 * - Shows empty state with CTA to Directory
 * - Normalizes favorites -> friendIds to avoid mismatched hook inputs
 */
export function ProfileFriendsSection() {
  const navigate = useNavigate();

  const { favorites, isLoading: favoritesLoading } = useFavorites();

  // ✅ Normalize favorites into a string[] of friend user IDs
  // Supports common shapes:
  // 1) favorites: string[]
  // 2) favorites: { friendIds: string[] }
  // 3) favorites: Array<{ friend_user_id: string }> or Array<{ friendId: string }> etc.
  const friendIds: string[] = useMemo(() => {
    if (!favorites) return [];

    // Case 1: already string[]
    if (Array.isArray(favorites) && favorites.every((v) => typeof v === "string")) {
      return favorites as string[];
    }

    // Case 2: object wrapper
    if (
      typeof favorites === "object" &&
      !Array.isArray(favorites) &&
      "friendIds" in (favorites as any) &&
      Array.isArray((favorites as any).friendIds)
    ) {
      return ((favorites as any).friendIds as unknown[]).filter((v): v is string => typeof v === "string");
    }

    // Case 3: array of rows/objects
    if (Array.isArray(favorites)) {
      const candidates = ["friend_user_id", "friendUserId", "friend_id", "friendId", "user_id", "userId"];
      const ids: string[] = [];

      for (const row of favorites as any[]) {
        if (!row || typeof row !== "object") continue;

        const foundKey = candidates.find((k) => typeof row?.[k] === "string");
        if (foundKey) ids.push(row[foundKey]);
      }

      // Deduplicate
      return Array.from(new Set(ids));
    }

    return [];
  }, [favorites]);

  // ✅ Always default friendProfiles to [] so `.length` never crashes
  const { friendProfiles = [], isLoading: profilesLoading, error: profilesError } = useFriendProfiles(friendIds);

  const isLoading = favoritesLoading || profilesLoading;

  // Header component to keep UI consistent
  const Header = ({ count }: { count?: number }) => (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-medium text-foreground flex items-center gap-2">
        <Users className="w-4 h-4" />
        Friends
        {typeof count === "number" ? <span className="text-xs text-muted-foreground">({count})</span> : null}
      </h3>
    </div>
  );

  // Loading state (no flashing zeros)
  if (isLoading) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5 py-4">
        <Header />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="w-16 h-16 rounded-full" />
          ))}
        </div>
      </motion.div>
    );
  }

  // Error state (don’t silently show 0)
  if (profilesError) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5 py-4">
        <Header />
        <div className="rounded-xl bg-muted/30 border border-border/50 p-4 text-sm text-muted-foreground">
          Couldn’t load friends right now.
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={() => navigate("/directory")}>
              Find Creators
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Empty state (still shows section + CTA)
  if (friendIds.length === 0 || friendProfiles.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5 py-4">
        <Header count={0} />
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-xl bg-muted/30 border border-border/50 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">You haven&apos;t added any friends yet.</p>
          <Button size="sm" onClick={() => navigate("/directory")}>
            Find Creators
          </Button>
        </div>
      </motion.div>
    );
  }

  // Normal state
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5 py-4">
      <Header count={friendProfiles.length} />

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-2">
          {friendProfiles.map((friend: any) => {
            const id: string = friend.user_id || friend.userId || friend.id || friend.profile_id || "";

            const name: string = friend.display_name || friend.displayName || friend.username || "User";

            const avatarUrl: string | undefined = friend.avatar_url || friend.avatarUrl || undefined;

            const firstLetter = typeof name === "string" && name.length > 0 ? name.charAt(0).toUpperCase() : "?";

            return (
              <div
                key={id || name}
                className="flex flex-col items-center gap-1 cursor-pointer group"
                onClick={() => id && navigate(`/profile/${id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && id) navigate(`/profile/${id}`);
                }}
              >
                <Avatar className="w-16 h-16 border-2 border-border group-hover:border-primary transition-colors">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="bg-muted text-muted-foreground">{firstLetter}</AvatarFallback>
                </Avatar>

                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[72px] text-center">
                  {name.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>

        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </motion.div>
  );
}
