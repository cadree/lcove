import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Users, Search, UserMinus, Loader2 } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useFriendProfiles } from "@/hooks/useFriendProfiles";

interface FriendsDrawerProps {
  children: React.ReactNode;
}

export function FriendsDrawer({ children }: FriendsDrawerProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { favorites, removeFavorite, isLoading: favoritesLoading } = useFavorites();
  const { friendProfiles, isLoading: profilesLoading } = useFriendProfiles(favorites);

  const isLoading = favoritesLoading || profilesLoading;

  const filteredFriends = friendProfiles.filter(friend =>
    friend.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProfileClick = (userId: string) => {
    setOpen(false);
    navigate(`/profile/${userId}`);
  };

  const handleRemoveFriend = (e: React.MouseEvent, friendId: string) => {
    e.stopPropagation();
    removeFavorite.mutate(friendId);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-96 p-0">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Friends ({favorites.length})
          </SheetTitle>
        </SheetHeader>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-180px)] px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {favorites.length === 0
                  ? "No friends added yet"
                  : "No friends match your search"}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {favorites.length === 0
                  ? "Visit profiles and add them as friends!"
                  : "Try a different search term"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredFriends.map((friend, index) => (
                  <motion.div
                    key={friend.user_id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleProfileClick(friend.user_id)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-card hover:bg-accent/20 transition-all cursor-pointer group"
                  >
                    <Avatar className="w-12 h-12 border-2 border-border group-hover:border-primary/50 transition-colors">
                      <AvatarImage src={friend.avatar_url || undefined} />
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        {friend.display_name?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {friend.display_name || 'Anonymous'}
                      </p>
                      {friend.city && (
                        <p className="text-sm text-muted-foreground truncate">
                          {friend.city}
                        </p>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleRemoveFriend(e, friend.user_id)}
                      title="Remove friend"
                    >
                      <UserMinus className="w-4 h-4 text-destructive" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
