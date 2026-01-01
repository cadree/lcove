import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useNetwork,
  useNetworkContent,
  useNetworkSubscription,
  useSubscribeToNetwork,
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
  const [activeTab, setActiveTab] = useState('all');
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const { data: network, isLoading: networkLoading } = useNetwork(networkId || '');
  const { data: content = [], isLoading: contentLoading } = useNetworkContent(networkId || '');
  const { data: subscription } = useNetworkSubscription(networkId || '');
  const subscribeMutation = useSubscribeToNetwork();

  const isSubscribed = subscription?.subscribed || !network?.is_paid;
  const isOwner = user?.id === network?.owner_id;

  const filteredContent = content.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const featuredContent = filteredContent.filter((c) => c.is_featured);
  const shortFilms = filteredContent.filter((c) => c.content_type === 'short_film');
  const tvShows = filteredContent.filter((c) => c.content_type === 'tv_show');
  const featureFilms = filteredContent.filter((c) => c.content_type === 'feature_film');

  const heroContent = featuredContent[0] || filteredContent[0];

  const handlePlayContent = (item: NetworkContent) => {
    setPlayingContent(item);
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

      {/* Netflix-style Hero */}
      <div className="relative h-[80vh] md:h-[90vh] w-full overflow-hidden">
        {/* Hero Background */}
        <div className="absolute inset-0">
          {heroContent?.cover_art_url || network.banner_url ? (
            <img
              src={heroContent?.cover_art_url || network.banner_url}
              alt={heroContent?.title || network.name}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 via-background to-accent/20" />
          )}
          {/* Netflix-style gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Top Navigation */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-background/80 to-transparent">
          <div className="flex items-center justify-between px-4 md:px-12 py-4">
            <div className="flex items-center gap-4">
              <Link to="/cinema">
                <Button variant="ghost" size="icon" className="text-foreground hover:bg-background/20">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              {network.logo_url && (
                <img src={network.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
              )}
              <span className="font-display text-xl font-bold text-foreground hidden md:block">
                {network.name}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[180px] bg-background/50 backdrop-blur-sm border-border/30 focus:w-[250px] transition-all"
                />
              </div>
              
              {user && !isOwner && (
                <Button variant="ghost" size="icon" onClick={() => setSubmitDialogOpen(true)} className="hover:bg-background/20">
                  <Send className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-[12%] md:bottom-[15%] left-0 right-0 px-4 md:px-12 z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            {/* Network Badge */}
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                {network.genre || 'Network'}
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                {network.subscriber_count} subscribers
              </span>
            </div>

            {/* Title */}
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-3 leading-[1.1]">
              {heroContent?.title || network.name}
            </h1>
            
            {/* Meta info */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4 flex-wrap">
              {heroContent?.runtime_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {heroContent.runtime_minutes}m
                </span>
              )}
              {heroContent?.genre_tags?.[0] && (
                <span>{heroContent.genre_tags[0]}</span>
              )}
              {heroContent?.is_featured && (
                <Badge variant="outline" className="border-primary/50 text-primary">
                  <Star className="w-3 h-3 mr-1" />
                  Featured
                </Badge>
              )}
            </div>

            {/* Description */}
            <p className="text-muted-foreground text-base md:text-lg line-clamp-2 md:line-clamp-3 mb-6 max-w-xl">
              {heroContent?.description || network.description}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {heroContent && (
                <Button
                  size="lg"
                  onClick={() => handlePlayContent(heroContent)}
                  className="gap-2 bg-foreground text-background hover:bg-foreground/90 font-semibold px-6"
                >
                  {isSubscribed || isOwner ? (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      Play
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Preview
                    </>
                  )}
                </Button>
              )}
              
              {heroContent && (
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => setSelectedContent(heroContent)}
                  className="gap-2 bg-secondary/80 hover:bg-secondary font-semibold px-6"
                >
                  <Info className="w-5 h-5" />
                  More Info
                </Button>
              )}

              {network.is_paid && !isSubscribed && !isOwner && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => subscribeMutation.mutate(networkId!)}
                  disabled={subscribeMutation.isPending}
                  className="gap-2 border-primary/50 text-primary hover:bg-primary/10"
                >
                  <Bell className="w-4 h-4" />
                  Subscribe - ${network.subscription_price}/mo
                </Button>
              )}

              {user && !isOwner && (
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => setSubmitDialogOpen(true)}
                  className="gap-2 hover:bg-background/20 md:flex hidden"
                >
                  <Plus className="w-4 h-4" />
                  Submit Content
                </Button>
              )}
            </div>
          </motion.div>
        </div>

        {/* Mute Toggle (for future video preview) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMuted(!isMuted)}
          className="absolute bottom-[12%] right-4 md:right-12 z-10 rounded-full border border-foreground/30 bg-background/20 hover:bg-background/40"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
      </div>

      {/* Mobile Search */}
      <div className="md:hidden px-4 py-3 sticky top-0 z-30 bg-background/95 backdrop-blur-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search in this network..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border/50"
          />
        </div>
      </div>

      {/* Content Section */}
      <div className="px-4 md:px-12 py-6 space-y-8">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card/50 p-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-foreground data-[state=active]:text-background">All</TabsTrigger>
            <TabsTrigger value="films" className="data-[state=active]:bg-foreground data-[state=active]:text-background">Films</TabsTrigger>
            <TabsTrigger value="shows" className="data-[state=active]:bg-foreground data-[state=active]:text-background">TV Shows</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content Display */}
        {contentLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="text-center py-16">
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
          <>
            {/* Featured Row */}
            {featuredContent.length > 0 && activeTab === 'all' && (
              <ContentRow
                title="Featured"
                items={featuredContent}
                onSelect={setSelectedContent}
                onPlay={handlePlayContent}
                isSubscribed={isSubscribed || isOwner}
              />
            )}

            {/* Short Films */}
            {shortFilms.length > 0 && (activeTab === 'all' || activeTab === 'films') && (
              <ContentRow
                title="Short Films"
                items={shortFilms}
                onSelect={setSelectedContent}
                onPlay={handlePlayContent}
                isSubscribed={isSubscribed || isOwner}
              />
            )}

            {/* Feature Films */}
            {featureFilms.length > 0 && (activeTab === 'all' || activeTab === 'films') && (
              <ContentRow
                title="Feature Films"
                items={featureFilms}
                onSelect={setSelectedContent}
                onPlay={handlePlayContent}
                isSubscribed={isSubscribed || isOwner}
              />
            )}

            {/* TV Shows */}
            {tvShows.length > 0 && (activeTab === 'all' || activeTab === 'shows') && (
              <ContentRow
                title="TV Shows"
                items={tvShows}
                onSelect={setSelectedContent}
                onPlay={handlePlayContent}
                isSubscribed={isSubscribed || isOwner}
              />
            )}

            {/* All Content Grid */}
            <div>
              <h2 className="font-display text-xl font-semibold mb-4">Browse All</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
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
          </>
        )}
      </div>

      {/* Bottom padding for mobile nav */}
      <div className="h-24" />

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
    </div>
  );
};

// Content Row Component
const ContentRow = ({
  title,
  items,
  onSelect,
  onPlay,
  isSubscribed,
}: {
  title: string;
  items: NetworkContent[];
  onSelect: (content: NetworkContent) => void;
  onPlay: (content: NetworkContent) => void;
  isSubscribed: boolean;
}) => (
  <div className="group/row">
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-display text-lg md:text-xl font-semibold">{title}</h2>
      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover/row:text-foreground transition-colors" />
    </div>
    <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4 md:-mx-12 md:px-12">
      <div className="flex gap-2 md:gap-3 pb-4">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            content={item}
            onSelect={onSelect}
            onPlay={onPlay}
            isSubscribed={isSubscribed}
            isRow
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
}: {
  content: NetworkContent;
  onSelect: (content: NetworkContent) => void;
  onPlay: (content: NetworkContent) => void;
  isSubscribed: boolean;
  isRow?: boolean;
}) => (
  <motion.div
    whileHover={{ scale: 1.05, zIndex: 10 }}
    transition={{ duration: 0.2 }}
    className={cn(
      "flex-shrink-0 group cursor-pointer",
      isRow ? "w-[120px] sm:w-[140px] md:w-[160px]" : "w-full"
    )}
    onClick={() => onSelect(content)}
  >
    <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-muted shadow-md">
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
      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 p-2">
        <Button
          size="sm"
          className="gap-1 h-8 px-3"
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
        <Button
          size="sm"
          variant="secondary"
          className="gap-1 h-8 px-3"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(content);
          }}
        >
          <Info className="w-3 h-3" />
          Info
        </Button>
      </div>

      {/* Content Type Badge */}
      <Badge
        className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 bg-background/80 text-foreground"
        variant="secondary"
      >
        {content.content_type === 'tv_show' ? 'Series' : content.content_type === 'short_film' ? 'Short' : 'Film'}
      </Badge>

      {/* Featured Badge */}
      {content.is_featured && (
        <Badge className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 bg-primary text-primary-foreground">
          <Star className="w-2.5 h-2.5" />
        </Badge>
      )}
    </div>

    {/* Title below card */}
    <div className="mt-2 px-0.5">
      <h3 className="font-medium text-sm text-foreground line-clamp-1">{content.title}</h3>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {content.runtime_minutes && (
          <span>{content.runtime_minutes}m</span>
        )}
        {content.runtime_minutes && content.genre_tags?.[0] && <span>•</span>}
        {content.genre_tags?.[0] && (
          <span className="truncate">{content.genre_tags[0]}</span>
        )}
      </div>
    </div>
  </motion.div>
);

export default NetworkPage;
