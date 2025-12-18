import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMyStore, useStoreItems, useMyStoreItems, StoreItem } from '@/hooks/useStore';
import PageLayout from '@/components/layout/PageLayout';
import { StoreItemCard } from '@/components/store/StoreItemCard';
import { StoreItemDialog } from '@/components/store/StoreItemDialog';
import { CreateItemDialog } from '@/components/store/CreateItemDialog';
import { StoreSetupDialog } from '@/components/store/StoreSetupDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Wrench,
  Building2,
  Plus,
  Search,
  Store as StoreIcon,
  Settings,
  ShoppingBag,
} from 'lucide-react';

const Store = () => {
  const { user } = useAuth();
  const { data: myStore, isLoading: isLoadingStore } = useMyStore();
  const { data: myItems } = useMyStoreItems();
  const [activeTab, setActiveTab] = useState<'products' | 'services' | 'rentals' | 'my-store'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [storeSetupOpen, setStoreSetupOpen] = useState(false);
  const [editItem, setEditItem] = useState<StoreItem | null>(null);

  // Fetch items based on active tab
  const typeMap = {
    products: 'product' as const,
    services: 'service' as const,
    rentals: 'rental' as const,
  };
  const currentType = activeTab !== 'my-store' ? typeMap[activeTab] : undefined;
  const { data: items, isLoading } = useStoreItems(currentType);

  // Filter items by search
  const filteredItems = (activeTab === 'my-store' ? myItems : items)?.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleItemClick = (item: StoreItem) => {
    setSelectedItem(item);
    setItemDialogOpen(true);
  };

  const handleEditItem = (item: StoreItem) => {
    setEditItem(item);
    setCreateDialogOpen(true);
  };

  const handleCreateNew = () => {
    setEditItem(null);
    setCreateDialogOpen(true);
  };

  const tabConfig = [
    { id: 'products', label: 'Products', icon: Package },
    { id: 'services', label: 'Services', icon: Wrench },
    { id: 'rentals', label: 'Studios', icon: Building2 },
  ];

  return (
    <PageLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-8 h-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Store</h1>
                  <p className="text-sm text-muted-foreground">
                    Discover products, services & studio rentals
                  </p>
                </div>
              </div>
              {user && (
                <div className="flex items-center gap-2">
                  {myStore ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStoreSetupOpen(true)}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Store Settings
                      </Button>
                      <Button size="sm" onClick={handleCreateNew}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Item
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setStoreSetupOpen(true)}>
                      <StoreIcon className="w-4 h-4 mr-2" />
                      Create Store
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="container mx-auto px-4 py-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="mb-6">
              {tabConfig.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
              {user && myStore && (
                <TabsTrigger value="my-store" className="flex items-center gap-2">
                  <StoreIcon className="w-4 h-4" />
                  My Store
                  {myItems && myItems.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {myItems.length}
                    </Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            {/* Content */}
            {['products', 'services', 'rentals', 'my-store'].map((tabId) => (
              <TabsContent key={tabId} value={tabId}>
                {isLoading || isLoadingStore ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="space-y-3">
                        <Skeleton className="aspect-square rounded-lg" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                      {tabId === 'products' && <Package className="w-8 h-8 text-muted-foreground" />}
                      {tabId === 'services' && <Wrench className="w-8 h-8 text-muted-foreground" />}
                      {tabId === 'rentals' && <Building2 className="w-8 h-8 text-muted-foreground" />}
                      {tabId === 'my-store' && <StoreIcon className="w-8 h-8 text-muted-foreground" />}
                    </div>
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      {tabId === 'my-store' 
                        ? 'Your store is empty'
                        : `No ${tabId} found`
                      }
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {tabId === 'my-store'
                        ? 'Start adding items to your store to sell to the community.'
                        : searchQuery
                          ? 'Try adjusting your search.'
                          : 'Check back later for new listings.'
                      }
                    </p>
                    {tabId === 'my-store' && user && myStore && (
                      <Button onClick={handleCreateNew}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Item
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredItems.map((item) => (
                      <div key={item.id} className="relative group">
                        <StoreItemCard
                          item={item}
                          onClick={() => handleItemClick(item)}
                          showSeller={tabId !== 'my-store'}
                        />
                        {tabId === 'my-store' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditItem(item);
                            }}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      {/* Dialogs */}
      <StoreItemDialog
        item={selectedItem}
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
      />

      <CreateItemDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setEditItem(null);
        }}
        editItem={editItem}
        defaultType={activeTab !== 'my-store' ? typeMap[activeTab] : undefined}
      />

      <StoreSetupDialog
        open={storeSetupOpen}
        onOpenChange={setStoreSetupOpen}
        store={myStore}
      />
    </PageLayout>
  );
};

export default Store;
