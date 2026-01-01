import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Film, 
  Play, 
  Plus, 
  Search, 
  TrendingUp, 
  Star,
  Tv,
  Clapperboard,
  ChevronLeft,
  ChevronRight,
  Users,
  ArrowLeft,
  Info
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useNetworks, useMyNetworks, useContentGenres, Network } from '@/hooks/useCinema';
import { useAuth } from '@/contexts/AuthContext';
import { CreateNetworkDialog } from '@/components/cinema/CreateNetworkDialog';
import { cn } from '@/lib/utils';

const Cinema = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  
  const { data: networks = [], isLoading } = useNetworks(selectedGenre);
  const { data: myNetworks = [] } = useMyNetworks();
  const { data: genres = [] } = useContentGenres();

  const filteredNetworks = networks.filter(network =>
    network.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    network.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const featuredNetworks = filteredNetworks.filter(n => n.subscriber_count > 0).slice(0, 5);
  const trendingNetworks = [...filteredNetworks].sort((a, b) => b.total_views - a.total_views).slice(0, 10);
  const newNetworks = [...filteredNetworks].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 10);

  const currentFeatured = featuredNetworks[featuredIndex] || filteredNetworks[0];

  const nextFeatured = () => {
    if (featuredNetworks.length > 1) {
      setFeaturedIndex((prev) => (prev + 1) % featuredNetworks.length);
    }
  };

  const prevFeatured = () => {
    if (featuredNetworks.length > 1) {
      setFeaturedIndex((prev) => (prev - 1 + featuredNetworks.length) % featuredNetworks.length);
    }
  };

  return (
    <PageLayout>
      <div className="min-h-screen bg-background">
        {/* Netflix-style Hero Section */}
        {currentFeatured && (
          <div className="relative h-[70vh] md:h-[85vh] w-full overflow-hidden">
            {/* Background Image */}
            <div className="absolute inset-0">
              {currentFeatured.banner_url ? (
                <img
                  src={currentFeatured.banner_url}
                  alt={currentFeatured.name}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 via-background to-accent/20" />
              )}
              {/* Gradient overlays for Netflix effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
            </div>

            {/* Top Navigation Bar */}
            <div className="absolute top-0 left-0 right-0 z-20">
              <div className="flex items-center justify-between px-4 md:px-12 py-4">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-foreground hover:bg-background/20">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <Film className="w-8 h-8 text-primary" />
                    <span className="font-display text-2xl font-bold text-foreground">LC Cinema</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Search Toggle */}
                  <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-[200px] bg-background/50 backdrop-blur-sm border-border/30 focus:w-[300px] transition-all"
                    />
                  </div>
                  
                  {user && (
                    <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Create Network</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Hero Content */}
            <div className="absolute bottom-[15%] md:bottom-[20%] left-0 right-0 px-4 md:px-12 z-10">
              <motion.div
                key={currentFeatured.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-2xl"
              >
                {currentFeatured.logo_url && (
                  <img 
                    src={currentFeatured.logo_url} 
                    alt="" 
                    className="w-14 h-14 md:w-20 md:h-20 rounded-xl mb-4 object-cover shadow-lg"
                  />
                )}
                <Badge variant="secondary" className="mb-3 bg-primary/20 text-primary border-primary/30">
                  Featured Network
                </Badge>
                <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-3 leading-tight">
                  {currentFeatured.name}
                </h1>
                <p className="text-muted-foreground text-base md:text-lg line-clamp-2 md:line-clamp-3 mb-4 max-w-xl">
                  {currentFeatured.description}
                </p>
                
                <div className="flex items-center gap-2 mb-6 flex-wrap">
                  {currentFeatured.genre && (
                    <Badge variant="outline" className="text-foreground border-foreground/30">
                      {currentFeatured.genre}
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {currentFeatured.subscriber_count} subscribers
                  </span>
                  {currentFeatured.is_paid && (
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      ${currentFeatured.subscription_price}/mo
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Link to={`/cinema/network/${currentFeatured.id}`}>
                    <Button size="lg" className="gap-2 bg-foreground text-background hover:bg-foreground/90 font-semibold px-6">
                      <Play className="w-5 h-5 fill-current" />
                      Watch Now
                    </Button>
                  </Link>
                  <Link to={`/cinema/network/${currentFeatured.id}`}>
                    <Button size="lg" variant="secondary" className="gap-2 bg-secondary/80 hover:bg-secondary font-semibold px-6">
                      <Info className="w-5 h-5" />
                      More Info
                    </Button>
                  </Link>
                </div>
              </motion.div>

              {/* Featured Navigation Dots */}
              {featuredNetworks.length > 1 && (
                <div className="flex items-center gap-4 mt-6">
                  <Button variant="ghost" size="icon" onClick={prevFeatured} className="w-8 h-8 rounded-full bg-background/30 hover:bg-background/50">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex gap-2">
                    {featuredNetworks.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setFeaturedIndex(idx)}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all",
                          idx === featuredIndex ? "w-6 bg-primary" : "bg-foreground/30 hover:bg-foreground/50"
                        )}
                      />
                    ))}
                  </div>
                  <Button variant="ghost" size="icon" onClick={nextFeatured} className="w-8 h-8 rounded-full bg-background/30 hover:bg-background/50">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile Search */}
        <div className="md:hidden px-4 py-3 sticky top-0 z-30 bg-background/95 backdrop-blur-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search networks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-border/50"
            />
          </div>
        </div>

        {/* Genre Filter Pills */}
        <div className="px-4 md:px-12 py-4">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              <Badge
                variant={selectedGenre === undefined ? "default" : "outline"}
                className={cn(
                  "cursor-pointer px-4 py-2 text-sm transition-all",
                  selectedGenre === undefined && "bg-foreground text-background"
                )}
                onClick={() => setSelectedGenre(undefined)}
              >
                All
              </Badge>
              {genres.map((genre) => (
                <Badge
                  key={genre.id}
                  variant={selectedGenre === genre.name ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer px-4 py-2 text-sm transition-all",
                    selectedGenre === genre.name && "bg-foreground text-background"
                  )}
                  onClick={() => setSelectedGenre(genre.name)}
                >
                  {genre.name}
                </Badge>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Content Rows */}
        <div className="px-4 md:px-12 pb-24 space-y-8">
          {/* My Networks */}
          {myNetworks.length > 0 && (
            <NetworkRow
              title="My Networks"
              icon={<Clapperboard className="w-5 h-5" />}
              networks={myNetworks}
              showManage
            />
          )}

          {/* Trending */}
          {trendingNetworks.length > 0 && (
            <NetworkRow
              title="Trending Now"
              icon={<TrendingUp className="w-5 h-5 text-primary" />}
              networks={trendingNetworks}
            />
          )}

          {/* New Networks */}
          {newNetworks.length > 0 && (
            <NetworkRow
              title="New Arrivals"
              icon={<Star className="w-5 h-5 text-primary" />}
              networks={newNetworks}
            />
          )}

          {/* All Networks Grid */}
          <div>
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <Tv className="w-5 h-5" />
              Browse All Networks
            </h2>
            
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="aspect-video bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : filteredNetworks.length === 0 ? (
              <div className="text-center py-12">
                <Film className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No networks found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? 'Try a different search term' : 'Be the first to create a network!'}
                </p>
                {user && (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    Create Network
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                {filteredNetworks.map((network) => (
                  <NetworkCard key={network.id} network={network} />
                ))}
              </div>
            )}
          </div>
        </div>

        <CreateNetworkDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      </div>
    </PageLayout>
  );
};

// Netflix-style Network Row
const NetworkRow = ({ 
  title, 
  icon, 
  networks,
  showManage = false
}: { 
  title: string; 
  icon: React.ReactNode;
  networks: Network[];
  showManage?: boolean;
}) => (
  <div className="group/row">
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-display text-lg md:text-xl font-semibold flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover/row:text-foreground transition-colors" />
    </div>
    
    <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4 md:-mx-12 md:px-12">
      <div className="flex gap-2 md:gap-3 pb-4">
        {networks.map((network) => (
          <NetworkCard key={network.id} network={network} showManage={showManage} isRow />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  </div>
);

// Netflix-style Network Card
const NetworkCard = ({ network, showManage = false, isRow = false }: { network: Network; showManage?: boolean; isRow?: boolean }) => (
  <Link 
    to={showManage ? `/cinema/manage/${network.id}` : `/cinema/network/${network.id}`}
    className={cn(
      "flex-shrink-0 group",
      isRow ? "w-[160px] sm:w-[200px] md:w-[240px]" : "w-full"
    )}
  >
    <motion.div
      whileHover={{ scale: 1.05, zIndex: 10 }}
      transition={{ duration: 0.2 }}
      className="relative aspect-video rounded-md overflow-hidden bg-muted shadow-md"
    >
      {network.banner_url ? (
        <img
          src={network.banner_url}
          alt={network.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Film className="w-10 h-10 text-muted-foreground" />
        </div>
      )}
      
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3">
        <h3 className="font-semibold text-foreground text-sm line-clamp-1">{network.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-1">{network.genre || 'Mixed'}</p>
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" className="h-7 px-3 gap-1 text-xs">
            <Play className="w-3 h-3 fill-current" />
            {showManage ? 'Manage' : 'Watch'}
          </Button>
        </div>
      </div>

      {/* Price Badge */}
      {network.is_paid && (
        <Badge className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 bg-primary/90 text-primary-foreground">
          ${network.subscription_price}/mo
        </Badge>
      )}

      {/* Logo Overlay */}
      {network.logo_url && (
        <div className="absolute bottom-2 left-2 w-8 h-8 rounded-md overflow-hidden bg-background/80 backdrop-blur-sm group-hover:opacity-0 transition-opacity">
          <img src={network.logo_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}
    </motion.div>
    
    {/* Title below card (mobile friendly) */}
    <div className="mt-2 px-0.5 group-hover:hidden md:hidden">
      <h3 className="font-medium text-foreground text-sm truncate">{network.name}</h3>
      <p className="text-xs text-muted-foreground truncate">{network.genre || 'Mixed'}</p>
    </div>
  </Link>
);

export default Cinema;
