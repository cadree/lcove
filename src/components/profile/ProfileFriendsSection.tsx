import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";
import { useFriendProfiles } from "@/hooks/useFriendProfiles";
import { useFavorites } from "@/hooks/useFavorites";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileFriendsSection() {
  const navigate = useNavigate();
  const { favorites, isLoading: favoritesLoading } = useFavorites();
  const { friendProfiles, isLoading: profilesLoading } = useFriendProfiles(favorites);

  const isLoading = favoritesLoading || profilesLoading;

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 py-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Users className="w-4 h-4" />
            Friends
          </h3>
        </div>
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="w-16 h-16 rounded-full" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (friendProfiles.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 py-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-foreground" />
          <h3 className="font-medium text-foreground">Friends</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-xl bg-muted/30 border border-border/50 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            You haven't added any friends yet.
          </p>
          <Button 
            size="sm" 
            onClick={() => navigate('/directory')}
          >
            Find Creators
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-5 py-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <Users className="w-4 h-4" />
          Friends
          <span className="text-xs text-muted-foreground">({friendProfiles.length})</span>
        </h3>
      </div>
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-2">
          {friendProfiles.map((friend) => (
            <div
              key={friend.user_id}
              className="flex flex-col items-center gap-1 cursor-pointer group"
              onClick={() => navigate(`/profile/${friend.user_id}`)}
            >
              <Avatar className="w-16 h-16 border-2 border-border group-hover:border-primary transition-colors">
                <AvatarImage src={friend.avatar_url || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground">
                  {friend.display_name?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[64px] text-center">
                {friend.display_name?.split(' ')[0] || 'User'}
              </span>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </motion.div>
  );
}
