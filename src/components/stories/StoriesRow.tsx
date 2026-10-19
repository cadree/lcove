import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Star, Filter, AlertCircle, RefreshCw } from 'lucide-react';
import { useStories } from '@/hooks/useStories';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import StoryAvatar from './StoryAvatar';
import StoryViewer from './StoryViewer';
import StoryUpload from './StoryUpload';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

function EmptyStoryRing({ label }: { label: string }) {
  return (
    <div className="shrink-0" aria-hidden="true">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-foreground/30 bg-card/50">
        <span className="mono-label text-[8px] text-muted-foreground">{label}</span>
      </div>
      <span className="mt-1.5 block w-20 text-center font-body text-[10px] text-muted-foreground">Story</span>
    </div>
  );
}

const StoriesRow = () => {
  const {
    user
  } = useAuth();
  const {
    groupedStories,
    isLoading,
    error: storiesError,
    refetch
  } = useStories();
  const {
    favorites,
    isFavorite,
    toggleFavorite
  } = useFavorites();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const userStories = groupedStories[user?.id || ''] || [];

  // Filter other users' stories based on favorites filter
  const otherUsersWithStories = Object.entries(groupedStories).filter(([userId]) => userId !== user?.id).filter(([userId]) => !showFavoritesOnly || isFavorite(userId));
  const handleOpenStory = (userId: string) => {
    setSelectedUserId(userId);
  };
  const handleCloseStory = () => {
    setSelectedUserId(null);
  };
  const handleNextUser = () => {
    const userIds = Object.keys(groupedStories);
    const currentIndex = userIds.indexOf(selectedUserId || '');
    const nextIndex = currentIndex + 1;
    if (nextIndex < userIds.length) {
      setSelectedUserId(userIds[nextIndex]);
    } else {
      setSelectedUserId(null);
    }
  };

  const handleRetry = async () => {
    await refetch();
  };

  if (storiesError) {
    console.error('[StoriesRow] Error loading stories:', storiesError);
  }

  const ghostRings = otherUsersWithStories.length === 0 && !showFavoritesOnly;

  return <>
      <div className="flex items-center justify-between gap-2 px-1 pt-2">
        <p className="kicker">Stories</p>
        {user && favorites.length > 0 && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className={`h-8 gap-1.5 text-xs ${showFavoritesOnly ? 'text-primary' : 'text-muted-foreground'}`}>
                <Filter className="w-3.5 h-3.5" />
                {showFavoritesOnly ? 'Favorites' : 'All'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuCheckboxItem checked={!showFavoritesOnly} onCheckedChange={() => setShowFavoritesOnly(false)}>
                Show All
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={showFavoritesOnly} onCheckedChange={() => setShowFavoritesOnly(true)}>
                <Star className="w-3.5 h-3.5 mr-1.5 fill-primary text-primary" />
                Favorites Only
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>}
      </div>

      {storiesError && (
        <div className="flex items-center gap-2 px-1 pb-1">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-muted-foreground">Stories did not load</span>
          <Button variant="ghost" size="sm" onClick={handleRetry} className="h-7 px-2">
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      <motion.div initial={{
      opacity: 0,
      y: -10
    }} animate={{
      opacity: 1,
      y: 0
    }} className="flex gap-3 overflow-x-auto py-4 px-1 scrollbar-hide">
        {/* Add Story Button / Your Story */}
        {user && <motion.button whileTap={{
        scale: 0.95
      }} onClick={() => userStories.length > 0 ? handleOpenStory(user.id) : setShowUpload(true)} className="relative shrink-0 group">
            <div className="w-20 h-20 rounded-full relative">
              {/* Glass ring */}
              <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_120deg,#C4142D,#FF9FC8,#C4142D)] p-[2px]">
                <div className="w-full h-full rounded-full bg-card p-[2px]">
                  <div className="w-full h-full rounded-full overflow-hidden bg-muted flex items-center justify-center">
                    {userStories.length > 0 && userStories[0].profile?.avatar_url ? <img src={userStories[0].profile.avatar_url} alt="Your story" className="w-full h-full object-cover" /> : <Plus className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />}
                  </div>
                </div>
              </div>
            </div>
            <span className="text-[10px] text-foreground mt-1.5 block text-center truncate w-20 font-body">
              Your story
            </span>
          </motion.button>}

        {isLoading && [0, 1, 2, 3].map((slot) => (
          <div key={slot} className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-muted" />
        ))}

        {ghostRings && !isLoading && ["Open", "Soon", "Yours", "Next"].map((label) => (
          <EmptyStoryRing key={label} label={label} />
        ))}

        {/* Other Users' Stories */}
        <AnimatePresence mode="popLayout">
          {otherUsersWithStories.length === 0 && showFavoritesOnly ? <motion.div initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} className="flex items-center justify-center px-4 text-sm text-muted-foreground">
              No stories from favorites
            </motion.div> : otherUsersWithStories.map(([userId, userStoryList], index) => {
          const latestStory = userStoryList[0];
          const hasUnviewed = userStoryList.some((s) => !s.has_viewed);
          const isFav = isFavorite(userId);
          return <StoryAvatar key={userId} userId={userId} displayName={latestStory.profile?.display_name || 'User'} avatarUrl={latestStory.profile?.avatar_url} isLive={latestStory.is_live} hasUnviewed={hasUnviewed} isFavorite={isFav} onToggleFavorite={() => toggleFavorite(userId)} onClick={() => handleOpenStory(userId)} index={index} />;
        })}
        </AnimatePresence>
      </motion.div>

      {/* Story Viewer Modal */}
      <AnimatePresence>
        {selectedUserId && groupedStories[selectedUserId] && <StoryViewer stories={groupedStories[selectedUserId]} onClose={handleCloseStory} onNextUser={handleNextUser} />}
      </AnimatePresence>

      {/* Upload Dialog */}
      <StoryUpload open={showUpload} onOpenChange={setShowUpload} />
    </>;
};
export default StoriesRow;