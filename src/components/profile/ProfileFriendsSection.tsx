import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Users, ChevronRight } from "lucide-react";
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
        <Card className="bg-muted/30 border-border/50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground">No friends yet</h3>
              <p className="text-xs text-muted-foreground">
                Visit the Directory to find and add friends
              </p>
            </div>
            <ChevronRight 
              className="w-4 h-4 text-muted-foreground cursor-pointer" 
              onClick={() => navigate('/directory')}
            />
          </div>
        </Card>
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
