import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useMyStore, useStoreItems, useMyStoreItems, useDeleteStoreItem, StoreItem, Store as StoreType } from '@/hooks/useStore';
import { supabase } from '@/integrations/supabase/client';
import PageLayout from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  ArrowLeft,
  Trash2,
} from 'lucide-react';

const Store = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const storeIdParam = searchParams.get('store');
  
  const { data: myStore, isLoading: isLoadingStore } = useMyStore();
  const { data: myItems } = useMyStoreItems();
  const deleteItem = useDeleteStoreItem();
  const [activeTab, setActiveTab] = useState<'products' | 'services' | 'rentals' | 'my-store'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [storeSetupOpen, setStoreSetupOpen] = useState(false);
  const [editItem, setEditItem] = useState<StoreItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<StoreItem | null>(null);

  // Fetch the specific store if viewing another user's store
  const { data: viewingStore } = useQuery({
    queryKey: ['store-by-id', storeIdParam],
    queryFn: async () => {
      if (!storeIdParam) return null;
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeIdParam)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      
      // Fetch owner profile
      if (data) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, avatar_url, city')
          .eq('user_id', data.user_id)
          .single();
        
        return { ...data, profile } as StoreType & { profile?: { display_name: string; avatar_url: string; city: string } };
      }
      return null;
    },
    enabled: !!storeIdParam,
  });

  // Check if viewing own store
  const isViewingOwnStore = storeIdParam && myStore?.id === storeIdParam;

  const typeMap = {
    products: 'product' as const,
    services: 'service' as const,
    rentals: 'rental' as const,
  };
  const currentType = activeTab !== 'my-store' ? typeMap[activeTab] : undefined;
  
  // When viewing a specific store, always filter by that store ID
  const effectiveStoreId = storeIdParam || undefined;
  const { data: items, isLoading } = useStoreItems(
    storeIdParam ? undefined : currentType, // Don't filter by type when viewing a specific store
    effectiveStoreId
  );

  // Filter items by type when viewing a specific store
  const typeFilteredItems = storeIdParam && items
    ? (currentType ? items.filter(item => item.type === currentType) : items)
    : items;

  const filteredItems = (activeTab === 'my-store' ? myItems : typeFilteredItems)?.filter((item) =>
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

  const handleDeleteItem = (item: StoreItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      await deleteItem.mutateAsync(itemToDelete.id);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
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
            {/* Show store header when viewing a specific store */}
            {storeIdParam && viewingStore ? (
              <div className="mb-5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    searchParams.delete('store');
                    setSearchParams(searchParams);
                  }}
                  className="mb-3"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to All Stores
                </Button>
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 border-2 border-border">
                    <AvatarImage src={viewingStore.logo_url || viewingStore.profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-lg">{viewingStore.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{viewingStore.name}</h1>
                    <p className="text-muted-foreground">
                      {viewingStore.profile?.display_name}
                      {viewingStore.profile?.city && ` • ${viewingStore.profile.city}`}
                    </p>
                    {viewingStore.description && (
                      <p className="text-sm text-muted-foreground mt-1">{viewingStore.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <PageHeader
                title="Store"
                description="Discover products, services & studio rentals"
                icon={<ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
                className="mb-5"
                actions={
                  user && !storeIdParam && (
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
                  )
                }
              />
            )}

            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11"
              />
            </div>
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
                  // Count items per tab when viewing a specific store
                  const tabItemCount = storeIdParam && items
                    ? items.filter(item => item.type === typeMap[tab.id as keyof typeof typeMap]).length
                    : undefined;
                  return (
                    <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {tab.label}
                      {storeIdParam && tabItemCount !== undefined && tabItemCount > 0 && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {tabItemCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
                {user && myStore && !storeIdParam && (
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
                        storeIdParam && viewingStore
                          ? `No ${tabId === 'products' ? 'products' : tabId === 'services' ? 'services' : 'studios'} in this store`
                          : tabId === 'my-store' 
                            ? 'Your store is waiting'
                            : tabId === 'products'
                              ? 'No products yet'
                              : tabId === 'services'
                                ? 'No services available'
                                : 'No studios listed'
                      }
                      description={
                        storeIdParam && viewingStore
                          ? `${viewingStore.name} hasn't added any ${tabId === 'products' ? 'products' : tabId === 'services' ? 'services' : 'studios'} yet.`
                          : tabId === 'my-store'
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
                            showSeller={tabId !== 'my-store' && !storeIdParam}
                          />
                          {tabId === 'my-store' && (
                            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditItem(item);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItem(item);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{itemToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default Store;
