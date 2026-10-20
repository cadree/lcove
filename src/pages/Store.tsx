import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useMyStore, useStoreItems, useMyStoreItems, useDeleteStoreItem, importStoreCatalog, readRememberedStoreImport, readStoreImportMeta, StoreItem, Store as StoreType, StoreImportResult, STORE_PUBLIC_COLUMNS } from '@/hooks/useStore';
import { StoreBrandPanel } from '@/components/store/StoreBrandPanel';
import { supabase } from '@/integrations/supabase/client';
import PageLayout from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StoreItemCard } from '@/components/store/StoreItemCard';
import { StoreItemDialog } from '@/components/store/StoreItemDialog';
import { CreateItemDialog } from '@/components/store/CreateItemDialog';
import { StoreSetupDialog } from '@/components/store/StoreSetupDialog';
import { StorePayoutSetup } from '@/components/store/StorePayoutSetup';
import { BuyerOrders, SellerOrders } from '@/components/store/StoreOrdersPanel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
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
  Trash2,
  Receipt,
} from 'lucide-react';
import { toast } from 'sonner';
import { BackButton } from '@/components/navigation/BackButton';

const Store = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const storeIdParam = searchParams.get('store');
  
  const { data: myStore, isLoading: isLoadingStore } = useMyStore();
  const { data: myItems } = useMyStoreItems();
  const deleteItem = useDeleteStoreItem();
  const tabParam = searchParams.get('tab');
  const categoryParam = searchParams.get('category');
  const isStoreTab = (
    value: string | null,
  ): value is 'products' | 'services' | 'rentals' | 'my-store' | 'orders' =>
    value === 'products' || value === 'services' || value === 'rentals' || value === 'my-store' || value === 'orders';
  const [activeTab, setActiveTab] = useState<'products' | 'services' | 'rentals' | 'my-store' | 'orders'>(
    isStoreTab(tabParam) ? tabParam : 'products',
  );
  useEffect(() => {
    if (isStoreTab(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [storeSetupOpen, setStoreSetupOpen] = useState(false);
  const [importResult, setImportResult] = useState<StoreImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [showContinue, setShowContinue] = useState(
    () => searchParams.get('setup') === '1' || sessionStorage.getItem('ether-continue-feed') === '1',
  );
  const [editItem, setEditItem] = useState<StoreItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<StoreItem | null>(null);
  const handledQuery = useRef('');
  const [importVersion, setImportVersion] = useState(0);

  useEffect(() => {
    if (!myStore?.id) return;
    const remembered = readRememberedStoreImport(myStore.id);
    if (remembered) setImportResult(remembered);
    let cancel = false;
    readStoreImportMeta(myStore.id).then((meta) => {
      if (cancel || !meta?.import_status) return;
      if (remembered) return;
      const status = meta.import_status === 'link' || meta.import_status === 'failed' || meta.import_status === 'imported'
        ? meta.import_status
        : 'imported';
      setImportResult({
        ok: status !== 'failed',
        status,
        source: status === 'link' ? 'link' : 'shopify',
        imported: meta.import_count ?? 0,
        message: meta.import_error
          || (status === 'link'
            ? 'A link card was added from the page preview.'
            : `Imported ${meta.import_count ?? 0} products.`),
      });
    }).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [myStore?.id, importVersion]);

  useEffect(() => {
    const key = searchParams.toString();
    if (!key || handledQuery.current === key) return;
    const purchase = searchParams.get('purchase');
    const orderId = searchParams.get('order');
    const connectReturn = searchParams.get('connect_success') || searchParams.get('connect_refresh');
    if (!purchase && !connectReturn) return;
    handledQuery.current = key;

    if (connectReturn) {
      setActiveTab('my-store');
    }

    if (purchase === 'success') {
      toast.success('Payment received. The order is confirmed when Stripe notifies Ether.');
    } else if (purchase === 'cancel' || purchase === 'cancelled') {
      toast.message('Checkout canceled.');
      if (orderId) {
        supabase.functions.invoke('purchase-store-item', {
          body: { action: 'cancel', orderId },
        }).catch(() => {
          toast.error('The pending charge could not be cleared. It expires if checkout is not finished.');
        });
      }
    }

    if (purchase) {
      const next = new URLSearchParams(searchParams);
      next.delete('purchase');
      next.delete('order');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch the specific store if viewing another user's store
  const { data: viewingStore } = useQuery({
    queryKey: ['store-by-id', storeIdParam],
    queryFn: async () => {
      if (!storeIdParam) return null;
      const { data, error } = await supabase
        .from('stores')
        .select(STORE_PUBLIC_COLUMNS)
        .eq('id', storeIdParam)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      
      // Fetch owner profile
      if (data) {
        const { data: profile } = await supabase
          .from('profiles_public')
          .select('display_name, avatar_url, city')
          .eq('user_id', data.user_id)
          .maybeSingle();
        
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
  const currentType = activeTab === 'products' || activeTab === 'services' || activeTab === 'rentals'
    ? typeMap[activeTab]
    : undefined;
  
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

  const filteredItems = (activeTab === 'my-store' ? myItems : typeFilteredItems)?.filter((item) => {
    const matchesQuery = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryParam || item.category_id === categoryParam;
    return matchesQuery && matchesCategory;
  }) || [];

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

  const reimportStore = async (store: StoreType) => {
    const url = store.website_url || store.shopify_store_url;
    if (!url) {
      toast.error('Add a website before importing');
      return;
    }
    setImporting(true);
    const result = await importStoreCatalog(store.id, url);
    setImportResult(result);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
    await queryClient.invalidateQueries({ queryKey: ['my-store'] });
    await queryClient.invalidateQueries({ queryKey: ['store'] });
    await queryClient.invalidateQueries({ queryKey: ['store-items'] });
    setImporting(false);
  };

  const tabConfig = [
    { id: 'products' as const, label: 'Products', icon: Package },
    { id: 'services' as const, label: 'Services', icon: Wrench },
    { id: 'rentals' as const, label: 'Studios', icon: Building2 },
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
                <BackButton showLabel label="Back" className="mb-3" />
                <StoreBrandPanel
                  store={viewingStore}
                  importResult={isViewingOwnStore ? importResult : null}
                  importing={!!isViewingOwnStore && importing}
                  showContinue={!!isViewingOwnStore && showContinue}
                  onReimport={isViewingOwnStore ? () => reimportStore(viewingStore) : undefined}
                />
              </div>
            ) : (
              <PageHeader
                title="Store"
                description="Discover products, services & studio rentals"
                icon={<ShoppingBag className="w-5 h-5" />}
                tile="gold"
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
              <div
                className="mb-6 max-w-full min-w-0 overflow-x-auto overscroll-x-contain"
                onMouseDown={() => {
                  const x = window.scrollX;
                  const y = window.scrollY;
                  requestAnimationFrame(() => window.scrollTo(x, y));
                }}
              >
              <TabsList className="h-auto w-max min-w-full justify-start">
                {tabConfig.map((tab) => {
                  const Icon = tab.icon;
                  // Count items per tab when viewing a specific store
                  const tabItemCount = storeIdParam && items
                    ? items.filter(item => item.type === typeMap[tab.id as keyof typeof typeMap]).length
                    : undefined;
                  return (
                    <TabsTrigger key={tab.id} value={tab.id} className="flex shrink-0 items-center gap-2">
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
                  <TabsTrigger value="my-store" className="flex shrink-0 items-center gap-2">
                    <StoreIcon className="w-4 h-4" />
                    My Store
                    {myItems && myItems.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {myItems.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                )}
                {user && !storeIdParam && (
                  <TabsTrigger value="orders" className="flex shrink-0 items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Orders
                  </TabsTrigger>
                )}
              </TabsList>
              </div>

              {/* Content */}
              {['products', 'services', 'rentals', 'my-store', 'orders'].map((tabId) => (
                <TabsContent key={tabId} value={tabId}>
                  {(tabId === 'products' || tabId === 'my-store') && myStore && !storeIdParam && (
                    <StoreBrandPanel
                      store={myStore}
                      importResult={importResult}
                      importing={importing}
                      showContinue={showContinue}
                      onReimport={() => reimportStore(myStore)}
                    />
                  )}
                  {tabId === 'orders' ? (
                    <BuyerOrders />
                  ) : tabId === 'my-store' && myStore ? (
                    <div className="space-y-6 mb-6">
                      <StorePayoutSetup storeId={myStore.id} storeName={myStore.name} />
                      <SellerOrders />
                    </div>
                  ) : null}
                  {tabId === 'orders' ? null : isLoading || isLoadingStore ? (
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
        onOpenChange={(open) => {
          setStoreSetupOpen(open);
          if (!open) {
            setShowContinue(sessionStorage.getItem('ether-continue-feed') === '1');
            setImportVersion((version) => version + 1);
          }
        }}
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
