import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  ChevronRight,
  Users
} from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
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

  return (
    <div className="min-h-screen bg-background">
      {/* Cinematic Header */}
      <div className="relative bg-gradient-to-b from-primary/20 via-background to-background">
        <div className="absolute inset-0 bg-[url('/placeholder.svg')] opacity-5 bg-cover bg-center" />
        
        <div className="relative px-4 pt-8 pb-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Film className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-foreground">LC Cinema</h1>
                  <p className="text-sm text-muted-foreground">Creator-owned streaming networks</p>
                </div>
              </div>
              
              {user && (
                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Network
                </Button>
              )}
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search networks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card/50 backdrop-blur-sm border-border/50"
              />
            </div>

            {/* Genre Filter */}
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 pb-2">
                <Badge
                  variant={selectedGenre === undefined ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedGenre(undefined)}
                >
                  All
                </Badge>
                {genres.map((genre) => (
                  <Badge
                    key={genre.id}
                    variant={selectedGenre === genre.name ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedGenre(genre.name)}
                  >
                    {genre.name}
                  </Badge>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>
      </div>

      <div className="px-4 pb-24 max-w-7xl mx-auto space-y-8">
        {/* My Networks */}
        {myNetworks.length > 0 && (
          <NetworkCarousel
            title="My Networks"
            icon={<Clapperboard className="w-5 h-5" />}
            networks={myNetworks}
            showManage
          />
        )}

        {/* Featured Networks */}
        {featuredNetworks.length > 0 && (
          <FeaturedBanner network={featuredNetworks[0]} />
        )}

        {/* Trending */}
        {trendingNetworks.length > 0 && (
          <NetworkCarousel
            title="Trending"
            icon={<TrendingUp className="w-5 h-5" />}
            networks={trendingNetworks}
          />
        )}

        {/* New Networks */}
        {newNetworks.length > 0 && (
          <NetworkCarousel
            title="New Networks"
            icon={<Star className="w-5 h-5" />}
            networks={newNetworks}
          />
        )}

        {/* All Networks Grid */}
        <div>
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <Tv className="w-5 h-5" />
            All Networks
          </h2>
          
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-video bg-muted animate-pulse rounded-lg" />
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredNetworks.map((network) => (
                <NetworkCard key={network.id} network={network} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateNetworkDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
};

// Featured Banner Component
const FeaturedBanner = ({ network }: { network: Network }) => (
  <Link to={`/cinema/network/${network.id}`}>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl overflow-hidden aspect-[21/9] bg-gradient-to-r from-primary/30 to-accent/30"
    >
      {network.banner_url && (
        <img
          src={network.banner_url}
          alt={network.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
      
      <div className="absolute inset-0 flex items-center p-8">
        <div className="max-w-lg">
          {network.logo_url && (
            <img src={network.logo_url} alt="" className="w-16 h-16 rounded-xl mb-4 object-cover" />
          )}
          <Badge variant="secondary" className="mb-2">Featured Network</Badge>
          <h2 className="font-display text-3xl font-bold text-foreground mb-2">{network.name}</h2>
          <p className="text-muted-foreground line-clamp-2 mb-4">{network.description}</p>
          <div className="flex items-center gap-4">
            <Button className="gap-2">
              <Play className="w-4 h-4" />
              Watch Now
            </Button>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Users className="w-4 h-4" />
              {network.subscriber_count} subscribers
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  </Link>
);

// Network Carousel Component
const NetworkCarousel = ({ 
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
  <div>
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-display text-xl font-semibold flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    </div>
    
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-4 pb-4">
        {networks.map((network) => (
          <NetworkCard key={network.id} network={network} showManage={showManage} />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  </div>
);

// Network Card Component
const NetworkCard = ({ network, showManage = false }: { network: Network; showManage?: boolean }) => (
  <Link 
    to={showManage ? `/cinema/manage/${network.id}` : `/cinema/network/${network.id}`}
    className="flex-shrink-0 w-[200px] md:w-[240px] group"
  >
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="relative aspect-video rounded-lg overflow-hidden bg-muted"
    >
      {network.banner_url ? (
        <img
          src={network.banner_url}
          alt={network.name}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Film className="w-12 h-12 text-muted-foreground" />
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
        <Button size="sm" variant="secondary" className="gap-1">
          <Play className="w-3 h-3" />
          {showManage ? 'Manage' : 'Watch'}
        </Button>
      </div>

      {network.is_paid && (
        <Badge className="absolute top-2 right-2 text-xs" variant="secondary">
          ${network.subscription_price}/mo
        </Badge>
      )}
    </motion.div>
    
    <div className="mt-2">
      <h3 className="font-medium text-foreground truncate">{network.name}</h3>
      <p className="text-sm text-muted-foreground truncate">{network.genre || 'Mixed'}</p>
    </div>
  </Link>
);

export default Cinema;
