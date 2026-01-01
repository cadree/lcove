import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Info,
  Search,
  ArrowLeft,
  Lock,
  Film,
  Tv,
  Clock,
  Star,
  ChevronRight,
  Users,
  Bell,
  Send,
  Volume2,
  VolumeX,
  Plus,
  Check,
  ThumbsUp,
  ChevronDown,
  Menu,
  Settings,
  LogOut,
  HelpCircle,
  User,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  useNetwork,
  useNetworkContent,
  useNetworkSubscription,
  useSubscribeToNetwork,
  useWatchHistory,
  NetworkContent,
} from '@/hooks/useCinema';
import { useAuth } from '@/contexts/AuthContext';
import { ContentDetailDialog } from '@/components/cinema/ContentDetailDialog';
import { VideoPlayer } from '@/components/cinema/VideoPlayer';
import { SubmitContentDialog } from '@/components/cinema/SubmitContentDialog';
import { cn } from '@/lib/utils';

const NetworkPage = () => {
  const { networkId } = useParams<{ networkId: string }>();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContent, setSelectedContent] = useState<NetworkContent | null>(null);
  const [playingContent, setPlayingContent] = useState<NetworkContent | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'shows' | 'movies'>('all');
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: network, isLoading: networkLoading } = useNetwork(networkId || '');
  const { data: content = [], isLoading: contentLoading } = useNetworkContent(networkId || '');
  const { data: subscription } = useNetworkSubscription(networkId || '');
  const { data: watchHistory = [] } = useWatchHistory();
  const subscribeMutation = useSubscribeToNetwork();

  const isSubscribed = subscription?.subscribed || !network?.is_paid;
  const isOwner = user?.id === network?.owner_id;

  // Filter and organize content
  const filteredContent = useMemo(() => {
    let filtered = content.filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (activeFilter === 'shows') {
      filtered = filtered.filter((c) => c.content_type === 'tv_show');
    } else if (activeFilter === 'movies') {
      filtered = filtered.filter((c) => c.content_type !== 'tv_show');
    }

    return filtered;
  }, [content, searchQuery, activeFilter]);

  // Content rows
  const featuredContent = filteredContent.filter((c) => c.is_featured);
  const newContent = filteredContent.filter((c) => {
    const created = new Date(c.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 14);
    return created > weekAgo;
  });
  const topContent = [...filteredContent].sort((a, b) => b.view_count - a.view_count).slice(0, 10);
  const shortFilms = filteredContent.filter((c) => c.content_type === 'short_film');
  const tvShows = filteredContent.filter((c) => c.content_type === 'tv_show');
  const featureFilms = filteredContent.filter((c) => c.content_type === 'feature_film');

  // Continue watching (from watch history)
  const continueWatching = useMemo(() => {
    return watchHistory
      .filter((h) => !h.completed && h.content_id)
      .map((h) => {
        const contentItem = content.find((c) => c.id === h.content_id);
        return contentItem ? { ...contentItem, watchProgress: h } : null;
      })
      .filter(Boolean) as (NetworkContent & { watchProgress: { progress_seconds: number; duration_seconds: number | null } })[];
  }, [watchHistory, content]);

  const heroContent = featuredContent[0] || filteredContent[0];

  const handlePlayContent = (item: NetworkContent) => {
    setPlayingContent(item);
    setSelectedContent(null);
  };

  const handleSubscribe = () => {
    subscribeMutation.mutate(networkId!);
  };

  if (networkLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading network...</div>
      </div>
    );
  }

  if (!network) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Film className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-xl font-medium">Network not found</h1>
        <Link to="/cinema">
          <Button variant="outline">Back to Cinema</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Video Player Overlay */}
      <AnimatePresence>
        {playingContent && (
          <VideoPlayer
            content={playingContent}
            onClose={() => setPlayingContent(null)}
            isPreviewOnly={network?.is_paid && !isSubscribed && !isOwner}
            previewDuration={30}
            onSubscribe={handleSubscribe}
            networkPrice={network?.subscription_price}
          />
        )}
      </AnimatePresence>

      {/* Netflix-style Top Navigation */}
      <header className="fixed top-0 left-0 right-0 z-30 bg-gradient-to-b from-background via-background/80 to-transparent">
        <div className="flex items-center justify-between px-4 md:px-12 py-3">
          <div className="flex items-center gap-3 md:gap-6">
            <Link to="/cinema">
              <Button variant="ghost" size="icon" className="text-foreground hover:bg-background/20 -ml-2">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            
            {/* Network Logo/Name - mobile shows just logo */}
            <div className="flex items-center gap-2">
              {network.logo_url ? (
                <img src={network.logo_url} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Film className="w-4 h-4 text-primary" />
                </div>
              )}
              <span className="font-display text-lg font-bold text-foreground hidden md:block">
                {network.name}
              </span>
            </div>

            {/* Filter Pills - Desktop */}
            <div className="hidden md:flex items-center gap-2">
              <FilterPill active={activeFilter === 'shows'} onClick={() => setActiveFilter(activeFilter === 'shows' ? 'all' : 'shows')}>
                Shows
              </FilterPill>
              <FilterPill active={activeFilter === 'movies'} onClick={() => setActiveFilter(activeFilter === 'movies' ? 'all' : 'movies')}>
                Movies
              </FilterPill>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full border-border/50 bg-transparent hover:bg-background/30">
                    Categories <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {['Drama', 'Comedy', 'Action', 'Horror', 'Documentary'].map((cat) => (
                    <DropdownMenuItem key={cat}>{cat}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="flex items-center gap-1 md:gap-2">
            {/* Search */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSearchOpen(true)}
              className="hover:bg-background/20"
            >
              <Search className="w-5 h-5" />
            </Button>

            {/* Downloads/My List - Desktop */}
            <Button variant="ghost" size="icon" className="hover:bg-background/20 hidden md:flex">
              <Download className="w-5 h-5" />
            </Button>

            {/* Submit content - if user */}
            {user && !isOwner && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSubmitDialogOpen(true)} 
                className="hover:bg-background/20"
              >
                <Send className="w-5 h-5" />
              </Button>
            )}

            {/* Menu */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setMenuOpen(true)}
              className="hover:bg-background/20"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Filter Pills */}
        <div className="flex md:hidden items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          <FilterPill active={activeFilter === 'shows'} onClick={() => setActiveFilter(activeFilter === 'shows' ? 'all' : 'shows')}>
            Shows
          </FilterPill>
          <FilterPill active={activeFilter === 'movies'} onClick={() => setActiveFilter(activeFilter === 'movies' ? 'all' : 'movies')}>
            Movies
          </FilterPill>
          <FilterPill active={false} onClick={() => {}}>
            Categories <ChevronDown className="w-3 h-3 ml-0.5" />
          </FilterPill>
        </div>
      </header>

      {/* Netflix-style Hero */}
      <div className="relative h-[75vh] md:h-[85vh] w-full overflow-hidden pt-[100px] md:pt-0">
        {/* Hero Background */}
        <div className="absolute inset-0">
          {heroContent?.cover_art_url || network.banner_url ? (
            <img
              src={heroContent?.cover_art_url || network.banner_url}
              alt={heroContent?.title || network.name}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 via-background to-accent/20" />
          )}
          {/* Netflix-style gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-[15%] md:bottom-[18%] left-0 right-0 px-4 md:px-12 z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            {/* Network Badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-primary font-display font-bold text-sm tracking-widest uppercase">
                {network.name}
              </span>
            </div>

            {/* Title */}
            <h1 className="font-display text-3xl md:text-5xl lg:text-6xl font-bold text-foreground mb-2 leading-[1.1]">
              {heroContent?.title || 'Welcome'}
            </h1>

            {/* Meta badges */}
            {heroContent && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 flex-wrap">
                {heroContent.release_date && (
                  <span>{new Date(heroContent.release_date).getFullYear()}</span>
                )}
                {heroContent.content_type === 'tv_show' && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 border-muted-foreground/50">
                    SERIES
                  </Badge>
                )}
                {heroContent.runtime_minutes && (
                  <span>{heroContent.runtime_minutes}m</span>
                )}
                <Badge variant="outline" className="text-[10px] px-1 py-0 border-muted-foreground/50">
                  HD
                </Badge>
              </div>
            )}

            {/* Description */}
            <p className="text-muted-foreground text-sm md:text-base line-clamp-2 md:line-clamp-3 mb-4 max-w-lg">
              {heroContent?.description || network.description}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {heroContent && (
                <Button
                  size="lg"
                  onClick={() => handlePlayContent(heroContent)}
                  className="gap-2 bg-foreground text-background hover:bg-foreground/90 font-semibold px-5 md:px-8 h-10 md:h-12"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Play
                </Button>
              )}
              
              <Button
                size="lg"
                variant="secondary"
                onClick={() => heroContent && setSelectedContent(heroContent)}
                className="gap-2 bg-secondary/80 hover:bg-secondary font-semibold px-5 md:px-8 h-10 md:h-12"
              >
                <Info className="w-5 h-5" />
                My List
              </Button>

              {network.is_paid && !isSubscribed && !isOwner && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => subscribeMutation.mutate(networkId!)}
                  disabled={subscribeMutation.isPending}
                  className="gap-2 border-primary/50 text-primary hover:bg-primary/10 h-10 md:h-12"
                >
                  <Bell className="w-4 h-4" />
                  Subscribe ${network.subscription_price}/mo
                </Button>
              )}
            </div>
          </motion.div>
        </div>

        {/* Mute Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMuted(!isMuted)}
          className="absolute bottom-[15%] right-4 md:right-12 z-10 rounded-full border border-foreground/30 bg-background/20 hover:bg-background/40"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
      </div>

      {/* Content Section */}
      <div className="relative z-20 -mt-16 md:-mt-24 pb-24">
        {contentLoading ? (
          <div className="px-4 md:px-12">
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-[2/3] bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Film className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">No content yet</h3>
            <p className="text-muted-foreground">
              {isOwner
                ? 'Start adding content to your network!'
                : 'This network is just getting started. Check back soon!'}
            </p>
            {isOwner && (
              <Link to={`/cinema/manage/${networkId}`}>
                <Button className="mt-4">Manage Network</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8">
            {/* Continue Watching */}
            {continueWatching.length > 0 && (
              <ContinueWatchingRow
                items={continueWatching}
                onSelect={setSelectedContent}
                onPlay={handlePlayContent}
                isSubscribed={isSubscribed || isOwner}
                userName={user?.user_metadata?.full_name || 'you'}
              />
            )}

            {/* Top 10 */}
            {topContent.length >= 3 && (
              <Top10Row
                items={topContent}
                onSelect={setSelectedContent}
                onPlay={handlePlayContent}
                isSubscribed={isSubscribed || isOwner}
                networkName={network.name}
              />
            )}

            {/* New Arrivals */}
            {newContent.length > 0 && (
              <ContentRow
                title="New Arrivals"
                items={newContent}
                onSelect={setSelectedContent}
                onPlay={handlePlayContent}
                isSubscribed={isSubscribed || isOwner}
                badgeType="new"
              />
            )}

            {/* Featured */}
            {featuredContent.length > 0 && (
              <ContentRow
                title="Featured"
                items={featuredContent}
                onSelect={setSelectedContent}
                onPlay={handlePlayContent}
                isSubscribed={isSubscribed || isOwner}
              />
            )}

            {/* TV Shows */}
            {tvShows.length > 0 && (
              <ContentRow
                title="Series"
                items={tvShows}
                onSelect={setSelectedContent}
                onPlay={handlePlayContent}
                isSubscribed={isSubscribed || isOwner}
              />
            )}

            {/* Short Films */}
            {shortFilms.length > 0 && (
              <ContentRow
                title="Short Films"
                items={shortFilms}
                onSelect={setSelectedContent}
                onPlay={handlePlayContent}
                isSubscribed={isSubscribed || isOwner}
              />
            )}

            {/* Feature Films */}
            {featureFilms.length > 0 && (
              <ContentRow
                title="Feature Films"
                items={featureFilms}
                onSelect={setSelectedContent}
                onPlay={handlePlayContent}
                isSubscribed={isSubscribed || isOwner}
              />
            )}

            {/* Browse All */}
            <div className="px-4 md:px-12">
              <h2 className="font-display text-lg md:text-xl font-semibold mb-4">Browse All</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
                {filteredContent.map((item) => (
                  <ContentCard
                    key={item.id}
                    content={item}
                    onSelect={setSelectedContent}
                    onPlay={handlePlayContent}
                    isSubscribed={isSubscribed || isOwner}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content Detail Dialog */}
      <ContentDetailDialog
        content={selectedContent}
        onClose={() => setSelectedContent(null)}
        onPlay={handlePlayContent}
        isSubscribed={isSubscribed || isOwner}
      />

      {/* Submit Content Dialog */}
      <SubmitContentDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        networkId={networkId!}
        networkName={network.name}
      />

      {/* Search Sheet */}
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="top" className="h-auto">
          <SheetHeader className="sr-only">
            <SheetTitle>Search</SheetTitle>
          </SheetHeader>
          <div className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-lg bg-card border-border"
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Menu Sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="h-auto rounded-t-3xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="pt-2 pb-6 space-y-2">
            {isOwner && (
              <Link to={`/cinema/manage/${networkId}`} onClick={() => setMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-3 h-12">
                  <Settings className="w-5 h-5" />
                  Manage Network
                </Button>
              </Link>
            )}
            <Button variant="ghost" className="w-full justify-start gap-3 h-12">
              <User className="w-5 h-5" />
              Account
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3 h-12">
              <HelpCircle className="w-5 h-5" />
              Help
            </Button>
            <Link to="/cinema" onClick={() => setMenuOpen(false)}>
              <Button variant="ghost" className="w-full justify-start gap-3 h-12 text-muted-foreground">
                <LogOut className="w-5 h-5" />
                Exit Network
              </Button>
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

// Filter Pill Component
const FilterPill = ({ 
  children, 
  active, 
  onClick 
}: { 
  children: React.ReactNode; 
  active: boolean; 
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center",
      active 
        ? "bg-foreground text-background" 
        : "border border-border/50 text-foreground hover:border-foreground/50"
    )}
  >
    {children}
  </button>
);

// Continue Watching Row - with progress bars
const ContinueWatchingRow = ({
  items,
  onSelect,
  onPlay,
  isSubscribed,
  userName,
}: {
  items: (NetworkContent & { watchProgress: { progress_seconds: number; duration_seconds: number | null } })[];
  onSelect: (content: NetworkContent) => void;
  onPlay: (content: NetworkContent) => void;
  isSubscribed: boolean;
  userName: string;
}) => (
  <div className="group/row">
    <div className="flex items-center justify-between mb-3 px-4 md:px-12">
      <h2 className="font-display text-lg md:text-xl font-semibold">
        Continue Watching for {userName}
      </h2>
    </div>
    <ScrollArea className="w-full -mx-4 px-4 md:-mx-12 md:px-12">
      <div className="flex gap-2 md:gap-3 pb-4">
        {items.map((item) => {
          const progress = item.watchProgress.duration_seconds 
            ? (item.watchProgress.progress_seconds / item.watchProgress.duration_seconds) * 100 
            : 0;
          return (
            <div
              key={item.id}
              className="flex-shrink-0 w-[140px] md:w-[180px] group cursor-pointer"
              onClick={() => onSelect(item)}
            >
              <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
                {item.cover_art_url ? (
                  <img
                    src={item.cover_art_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Film className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    size="icon"
                    className="rounded-full w-12 h-12"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(item);
                    }}
                  >
                    <Play className="w-5 h-5 fill-current" />
                  </Button>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted-foreground/30">
                  <div 
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>

              {/* Info icons */}
              <div className="flex items-center justify-between mt-2">
                <button className="p-1.5 rounded-full border border-border/50 hover:border-foreground/50">
                  <Info className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 rounded-full border border-border/50 hover:border-foreground/50">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  </div>
);

// Top 10 Row - with large numbers
const Top10Row = ({
  items,
  onSelect,
  onPlay,
  isSubscribed,
  networkName,
}: {
  items: NetworkContent[];
  onSelect: (content: NetworkContent) => void;
  onPlay: (content: NetworkContent) => void;
  isSubscribed: boolean;
  networkName: string;
}) => (
  <div className="group/row">
    <div className="flex items-center justify-between mb-3 px-4 md:px-12">
      <h2 className="font-display text-lg md:text-xl font-semibold">
        Top 10 on {networkName} Today
      </h2>
    </div>
    <ScrollArea className="w-full -mx-4 px-4 md:-mx-12 md:px-12">
      <div className="flex gap-2 md:gap-3 pb-4 pl-6">
        {items.slice(0, 10).map((item, index) => (
          <div
            key={item.id}
            className="flex-shrink-0 relative group cursor-pointer"
            onClick={() => onSelect(item)}
          >
            {/* Large Number */}
            <span 
              className="absolute -left-8 md:-left-10 bottom-0 font-display text-[80px] md:text-[100px] font-black leading-none text-foreground/20 z-0 select-none"
              style={{ 
                WebkitTextStroke: '2px rgba(var(--foreground), 0.3)',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {index + 1}
            </span>
            
            {/* Card */}
            <div className="relative w-[100px] md:w-[130px] z-10 ml-4">
              <div className="aspect-[2/3] rounded-md overflow-hidden bg-muted">
                {item.cover_art_url ? (
                  <img
                    src={item.cover_art_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <Film className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}

                {/* New badge */}
                {isNewContent(item.created_at) && (
                  <Badge className="absolute bottom-2 left-2 text-[9px] px-1.5 py-0.5 bg-primary text-primary-foreground">
                    New Episode
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  </div>
);

// Content Row Component
const ContentRow = ({
  title,
  items,
  onSelect,
  onPlay,
  isSubscribed,
  badgeType,
}: {
  title: string;
  items: NetworkContent[];
  onSelect: (content: NetworkContent) => void;
  onPlay: (content: NetworkContent) => void;
  isSubscribed: boolean;
  badgeType?: 'new' | 'featured';
}) => (
  <div className="group/row">
    <div className="flex items-center justify-between mb-3 px-4 md:px-12">
      <h2 className="font-display text-lg md:text-xl font-semibold">{title}</h2>
      <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        See All <ChevronRight className="w-4 h-4" />
      </button>
    </div>
    <ScrollArea className="w-full -mx-4 px-4 md:-mx-12 md:px-12">
      <div className="flex gap-2 md:gap-3 pb-4">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            content={item}
            onSelect={onSelect}
            onPlay={onPlay}
            isSubscribed={isSubscribed}
            isRow
            badgeType={badgeType}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  </div>
);

// Content Card Component - Netflix style poster cards
const ContentCard = ({
  content,
  onSelect,
  onPlay,
  isSubscribed,
  isRow = false,
  badgeType,
}: {
  content: NetworkContent;
  onSelect: (content: NetworkContent) => void;
  onPlay: (content: NetworkContent) => void;
  isSubscribed: boolean;
  isRow?: boolean;
  badgeType?: 'new' | 'featured';
}) => (
  <motion.div
    whileHover={{ scale: 1.05, zIndex: 10 }}
    transition={{ duration: 0.2 }}
    className={cn(
      "flex-shrink-0 group cursor-pointer",
      isRow ? "w-[110px] sm:w-[120px] md:w-[140px]" : "w-full"
    )}
    onClick={() => onSelect(content)}
  >
    <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-muted shadow-lg">
      {content.cover_art_url ? (
        <img
          src={content.cover_art_url}
          alt={content.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          {content.content_type === 'tv_show' ? (
            <Tv className="w-8 h-8 text-muted-foreground" />
          ) : (
            <Film className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
      )}

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 p-2">
        <Button
          size="sm"
          className="gap-1 h-8 w-full"
          onClick={(e) => {
            e.stopPropagation();
            onPlay(content);
          }}
        >
          {isSubscribed ? (
            <>
              <Play className="w-3 h-3 fill-current" />
              Play
            </>
          ) : (
            <>
              <Lock className="w-3 h-3" />
              Preview
            </>
          )}
        </Button>
        <div className="flex gap-1 w-full">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 h-8 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(content);
            }}
          >
            <Info className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 h-8 px-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Badges */}
      {(badgeType === 'new' || isNewContent(content.created_at)) && (
        <Badge className="absolute bottom-2 left-2 text-[8px] md:text-[9px] px-1 md:px-1.5 py-0.5 bg-primary text-primary-foreground">
          Recently Added
        </Badge>
      )}
      
      {content.is_featured && badgeType !== 'new' && (
        <div className="absolute top-2 right-2 bg-primary/90 rounded p-0.5">
          <span className="text-[8px] font-bold text-primary-foreground px-1">TOP 10</span>
        </div>
      )}
    </div>
  </motion.div>
);

// Helper function
const isNewContent = (createdAt: string) => {
  const created = new Date(createdAt);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 14);
  return created > weekAgo;
};

export default NetworkPage;
