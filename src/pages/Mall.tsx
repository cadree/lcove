import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Search,
  Store,
  Package,
  Wrench,
  Building2,
  Sparkles,
  TrendingUp,
  ArrowRight,
  Grid3X3,
  LayoutList,
  ShoppingCart,
} from 'lucide-react';

interface StoreWithProfile {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
    city: string | null;
  };
  item_count?: number;
}

interface StoreCategory {
  id: string;
  name: string;
  type: 'product' | 'service' | 'rental';
}

const categoryIcons = {
  product: Package,
  service: Wrench,
  rental: Building2,
};

const Mall = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Fetch all active stores with profiles
  const { data: stores, isLoading: isLoadingStores } = useQuery({
    queryKey: ['mall-stores'],
    queryFn: async () => {
      const { data: storesData, error } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for store owners
      const userIds = storesData?.map(s => s.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, city')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Fetch item counts per store
      const storeIds = storesData?.map(s => s.id) || [];
      const { data: itemCounts } = await supabase
        .from('store_items')
        .select('store_id')
        .in('store_id', storeIds)
        .eq('is_active', true);

      const countMap = new Map<string, number>();
      itemCounts?.forEach(item => {
        countMap.set(item.store_id, (countMap.get(item.store_id) || 0) + 1);
      });

      return storesData?.map(store => ({
        ...store,
        profile: profileMap.get(store.user_id),
        item_count: countMap.get(store.id) || 0,
      })) as StoreWithProfile[];
    },
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['store-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_item_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as StoreCategory[];
    },
  });

  // Featured stores (top by item count)
  const featuredStores = stores?.filter(s => s.item_count && s.item_count > 0)
    .sort((a, b) => (b.item_count || 0) - (a.item_count || 0))
    .slice(0, 6) || [];

  // Filter stores
  const filteredStores = stores?.filter(store => {
    const matchesSearch = !searchQuery || 
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.profile?.display_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  }) || [];

  // Group categories by type
  const categoriesByType = categories?.reduce((acc, cat) => {
    if (!acc[cat.type]) acc[cat.type] = [];
    acc[cat.type].push(cat);
    return acc;
  }, {} as Record<string, StoreCategory[]>) || {};

  const typeConfig = [
    { id: 'product', label: 'Products', icon: Package, color: 'bg-primary/20 text-primary' },
    { id: 'service', label: 'Services', icon: Wrench, color: 'bg-accent/20 text-accent-foreground' },
    { id: 'rental', label: 'Studios', icon: Building2, color: 'bg-secondary/20 text-secondary-foreground' },
  ];

  return (
    <PageLayout>
      <div className="min-h-screen bg-background">
        {/* Hero Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 border-b border-border">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.1),transparent_50%)]" />
          <div className="container mx-auto px-4 py-8 relative">
            <PageHeader
              title="Creative Mall"
              description="Browse products, services, and studio rentals from talented creators"
              icon={<ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
              className="mb-6"
            />
            
            {/* Search Bar */}
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search stores, products, services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-lg bg-background/80 backdrop-blur-sm border-border/50"
              />
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {/* Quick Category Filters */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Browse by Type</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/store')}
                className="text-primary"
              >
                View All Items
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {typeConfig.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <Button
                    key={type.id}
                    variant={isSelected ? 'default' : 'outline'}
                    className={`${isSelected ? '' : type.color} transition-all`}
                    onClick={() => {
                      setSelectedType(isSelected ? null : type.id);
                      navigate(`/store?tab=${type.id}s`);
                    }}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {type.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Featured Creators */}
          {featuredStores.length > 0 && !searchQuery && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Featured Creators</h2>
              </div>
              <ScrollArea className="w-full">
                <div className="flex gap-4 pb-4">
                  {featuredStores.map((store) => (
                    <Card
                      key={store.id}
                      className="flex-shrink-0 w-72 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden group"
                      onClick={() => navigate(`/store?store=${store.id}`)}
                    >
                      <div className="h-24 bg-gradient-to-br from-primary/20 to-accent/20 relative overflow-hidden">
                        {store.cover_image_url && (
                          <img
                            src={store.cover_image_url}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        )}
                        <div className="absolute -bottom-6 left-4">
                          <Avatar className="w-12 h-12 border-2 border-background">
                            <AvatarImage src={store.logo_url || store.profile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              {store.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>
                      <CardContent className="pt-8 pb-4">
                        <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {store.name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {store.profile?.display_name || 'Creator'}
                          {store.profile?.city && ` • ${store.profile.city}`}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {store.item_count} items
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </section>
          )}

          {/* Category Grid */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-4">Browse Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(categoriesByType).map(([type, cats]) => {
                const Icon = categoryIcons[type as keyof typeof categoryIcons];
                return cats.map((cat) => (
                  <Button
                    key={cat.id}
                    variant="outline"
                    className="h-auto py-3 px-4 justify-start text-left hover:bg-muted/50 transition-all"
                    onClick={() => navigate(`/store?category=${cat.id}`)}
                  >
                    <Icon className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{cat.name}</span>
                  </Button>
                ));
              })}
            </div>
          </section>

          {/* All Stores */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">
                All Stores
                {filteredStores.length > 0 && (
                  <span className="text-muted-foreground font-normal ml-2">
                    ({filteredStores.length})
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                >
                  <LayoutList className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {isLoadingStores ? (
              <div className={viewMode === 'grid' 
                ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                : "space-y-3"
              }>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className={viewMode === 'grid' ? "h-48" : "h-20"} />
                ))}
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="text-center py-16">
                <Store className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium text-foreground mb-2">No stores found</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'Try adjusting your search.' : 'Be the first to create a store!'}
                </p>
                <Button className="mt-4" onClick={() => navigate('/store')}>
                  Create Your Store
                </Button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredStores.map((store) => (
                  <Card
                    key={store.id}
                    className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden group"
                    onClick={() => navigate(`/store?store=${store.id}`)}
                  >
                    <div className="aspect-[4/3] bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden">
                      {store.cover_image_url ? (
                        <img
                          src={store.cover_image_url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Store className="w-12 h-12 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={store.logo_url || store.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {store.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate text-sm group-hover:text-primary transition-colors">
                            {store.name}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {store.profile?.display_name}
                          </p>
                        </div>
                      </div>
                      {store.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {store.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredStores.map((store) => (
                  <Card
                    key={store.id}
                    className="cursor-pointer hover:shadow-md transition-all bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden"
                    onClick={() => navigate(`/store?store=${store.id}`)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar className="w-12 h-12 flex-shrink-0">
                        <AvatarImage src={store.logo_url || store.profile?.avatar_url || undefined} />
                        <AvatarFallback>{store.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate hover:text-primary transition-colors">
                          {store.name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {store.profile?.display_name}
                          {store.profile?.city && ` • ${store.profile.city}`}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {store.item_count || 0} items
                      </Badge>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </PageLayout>
  );
};

export default Mall;
