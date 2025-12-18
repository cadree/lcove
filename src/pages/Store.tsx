import { useState } from 'react';
import { motion } from 'framer-motion';
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
import { EmptyState } from '@/components/ui/empty-state';
import {
  Package,
  Wrench,
  Building2,
  Plus,
  Search,
  Store as StoreIcon,
  Settings,
  ShoppingBag,
  Sparkles,
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

  const typeMap = {
    products: 'product' as const,
    services: 'service' as const,
    rentals: 'rental' as const,
  };
  const currentType = activeTab !== 'my-store' ? typeMap[activeTab] : undefined;
  const { data: items, isLoading } = useStoreItems(currentType);

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
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-strong border-b border-border/30">
          <div className="container mx-auto px-4 py-5">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center justify-between mb-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-medium text-foreground">Store</h1>
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
                        Settings
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
            </motion.div>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="relative max-w-md"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11"
              />
            </motion.div>
          </div>
        </div>

        {/* Tabs */}
        <div className="container mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
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
                          <Skeleton className="aspect-square rounded-2xl" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      ))}
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <EmptyState
                      icon={tabId === 'products' ? Package : tabId === 'services' ? Wrench : tabId === 'rentals' ? Building2 : Sparkles}
                      title={
                        tabId === 'my-store' 
                          ? 'Your store is waiting'
                          : tabId === 'products'
                            ? 'No products yet'
                            : tabId === 'services'
                              ? 'No services available'
                              : 'No studios listed'
                      }
                      description={
                        tabId === 'my-store'
                          ? 'Share your creations, offer your skills, or list your space. The community is eager to discover what you have to offer.'
                          : searchQuery
                            ? 'Try adjusting your search to find what you need.'
                            : tabId === 'products'
                              ? 'Physical and digital goods from creators will appear here.'
                              : tabId === 'services'
                                ? 'Freelance services from community members will show up here.'
                                : 'Studio spaces and equipment rentals will be listed here.'
                      }
                      action={tabId === 'my-store' && user && myStore ? {
                        label: 'Add Your First Item',
                        onClick: handleCreateNew
                      } : undefined}
                    />
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {filteredItems.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="relative group"
                        >
                          <StoreItemCard
                            item={item}
                            onClick={() => handleItemClick(item)}
                            showSeller={tabId !== 'my-store'}
                          />
                          {tabId === 'my-store' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditItem(item);
                              }}
                            >
                              Edit
                            </Button>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </motion.div>
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
