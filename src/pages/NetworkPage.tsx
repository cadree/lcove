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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { cn } from '@/lib/utils';

const NetworkPage = () => {
  const { networkId } = useParams<{ networkId: string }>();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContent, setSelectedContent] = useState<NetworkContent | null>(null);
  const [playingContent, setPlayingContent] = useState<NetworkContent | null>(null);
  const [activeTab, setActiveTab] = useState('all');

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

  const handlePlayContent = (item: NetworkContent) => {
    if (!isSubscribed && !isOwner) {
      subscribeMutation.mutate(networkId!);
      return;
    }
    setPlayingContent(item);
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
          />
        )}
      </AnimatePresence>

      {/* Hero Banner */}
      <div className="relative h-[50vh] md:h-[60vh]">
        {network.banner_url ? (
          <img
            src={network.banner_url}
            alt={network.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-accent/30" />
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />

        {/* Back Button */}
        <div className="absolute top-4 left-4 z-10">
          <Link to="/cinema">
            <Button variant="ghost" size="icon" className="bg-background/50 backdrop-blur-sm">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
        </div>

        {/* Network Info */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
          <div className="max-w-4xl">
            <div className="flex items-center gap-4 mb-4">
              {network.logo_url && (
                <img
                  src={network.logo_url}
                  alt=""
                  className="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover"
                />
              )}
              <div>
                <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground">
                  {network.name}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  {network.genre && (
                    <Badge variant="secondary">{network.genre}</Badge>
                  )}
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {network.subscriber_count} subscribers
                  </span>
                  {network.is_paid && (
                    <Badge variant="outline">${network.subscription_price}/mo</Badge>
                  )}
                </div>
              </div>
            </div>

            <p className="text-muted-foreground max-w-2xl mb-6 line-clamp-3">
              {network.description}
            </p>

            <div className="flex items-center gap-3">
              {featuredContent[0] && (
                <Button
                  size="lg"
                  className="gap-2"
                  onClick={() => handlePlayContent(featuredContent[0])}
                >
                  {isSubscribed || isOwner ? (
                    <>
                      <Play className="w-5 h-5" />
                      Play Featured
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Subscribe to Watch
                    </>
                  )}
                </Button>
              )}
              
              {network.is_paid && !isSubscribed && !isOwner && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => subscribeMutation.mutate(networkId!)}
                  disabled={subscribeMutation.isPending}
                >
                  Subscribe - ${network.subscription_price}/mo
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-4 md:px-12 py-8 space-y-8">
        {/* Search & Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search in this network..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="films">Films</TabsTrigger>
              <TabsTrigger value="shows">TV Shows</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content Display */}
        {contentLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-muted animate-pulse rounded-lg" />
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
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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

      {/* Content Detail Dialog */}
      <ContentDetailDialog
        content={selectedContent}
        onClose={() => setSelectedContent(null)}
        onPlay={handlePlayContent}
        isSubscribed={isSubscribed || isOwner}
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
  <div>
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </div>
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-4 pb-4">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            content={item}
            onSelect={onSelect}
            onPlay={onPlay}
            isSubscribed={isSubscribed}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  </div>
);

// Content Card Component
const ContentCard = ({
  content,
  onSelect,
  onPlay,
  isSubscribed,
}: {
  content: NetworkContent;
  onSelect: (content: NetworkContent) => void;
  onPlay: (content: NetworkContent) => void;
  isSubscribed: boolean;
}) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    className="flex-shrink-0 w-[140px] md:w-[180px] group cursor-pointer"
    onClick={() => onSelect(content)}
  >
    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted">
      {content.cover_art_url ? (
        <img
          src={content.cover_art_url}
          alt={content.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          {content.content_type === 'tv_show' ? (
            <Tv className="w-10 h-10 text-muted-foreground" />
          ) : (
            <Film className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
      )}

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
        <Button
          size="sm"
          className="gap-1"
          onClick={(e) => {
            e.stopPropagation();
            onPlay(content);
          }}
        >
          {isSubscribed ? (
            <>
              <Play className="w-3 h-3" />
              Play
            </>
          ) : (
            <>
              <Lock className="w-3 h-3" />
              Subscribe
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1"
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
        className="absolute top-2 left-2 text-xs"
        variant="secondary"
      >
        {content.content_type === 'tv_show' ? 'Series' : content.content_type === 'short_film' ? 'Short' : 'Film'}
      </Badge>

      {/* Featured Badge */}
      {content.is_featured && (
        <Badge className="absolute top-2 right-2 text-xs bg-primary">
          <Star className="w-3 h-3 mr-1" />
          Featured
        </Badge>
      )}
    </div>

    <div className="mt-2">
      <h3 className="font-medium text-sm text-foreground truncate">{content.title}</h3>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {content.runtime_minutes && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {content.runtime_minutes}m
          </span>
        )}
        {content.genre_tags?.[0] && (
          <span>{content.genre_tags[0]}</span>
        )}
      </div>
    </div>
  </motion.div>
);

export default NetworkPage;
