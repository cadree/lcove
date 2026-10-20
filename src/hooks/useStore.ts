import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { readFunctionError } from '@/lib/functionError';
import { shotSessionEnabled } from '@/lib/shotSession';

function asStoreRecord(store: unknown): (Store & { user_id: string }) | null {
  if (!store || typeof store !== "object" || Array.isArray(store)) return null;
  if (!("user_id" in store) || typeof store.user_id !== "string") return null;
  return store as Store & { user_id: string };
}

export interface Store {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  is_active: boolean;
  accepts_credits: boolean;
  accepts_cash: boolean;
  shopify_store_url: string | null;
  peerspace_url: string | null;
  flat_shipping_cents?: number | null;
  tax_line_label?: string | null;
  tax_line_cents?: number | null;
  website_url?: string | null;
  import_status?: string | null;
  import_error?: string | null;
  import_count?: number | null;
  imported_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreImportResult {
  ok: boolean;
  status: 'imported' | 'link' | 'failed';
  source: 'shopify' | 'link' | null;
  imported: number;
  message: string;
  shop?: string;
}

const IMPORT_STORAGE = 'ether-store-import';

export function rememberStoreImport(storeId: string, result: StoreImportResult) {
  sessionStorage.setItem(`${IMPORT_STORAGE}:${storeId}`, JSON.stringify(result));
}

export function readRememberedStoreImport(storeId: string): StoreImportResult | null {
  try {
    const raw = sessionStorage.getItem(`${IMPORT_STORAGE}:${storeId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoreImportResult;
  } catch {
    return null;
  }
}

export async function importStoreCatalog(storeId: string, shopUrl: string): Promise<StoreImportResult> {
  const { data, error } = await supabase.functions.invoke('import-shopify-products', {
    body: { storeId, shopUrl },
  });
  if (error || (data && typeof data === 'object' && 'error' in data && data.error)) {
    const message = await readFunctionError(error, data, 'Could not import this store');
    const result: StoreImportResult = {
      ok: false,
      status: 'failed',
      source: null,
      imported: 0,
      message,
    };
    rememberStoreImport(storeId, result);
    return result;
  }
  const payload = (data ?? {}) as {
    source?: string;
    imported?: number;
    message?: string;
    shop?: string;
    brand?: { logo_url?: string; description?: string; cover_image_url?: string };
    brandSaved?: boolean;
  };
  if (payload.brand && payload.brandSaved === false) {
    await supabase.from('stores').update(payload.brand).eq('id', storeId);
  }
  const source = payload.source === 'link' ? 'link' : 'shopify';
  const imported = Number(payload.imported ?? 0);
  const result: StoreImportResult = {
    ok: true,
    status: source === 'link' ? 'link' : 'imported',
    source,
    imported,
    message: payload.message
      || (source === 'link'
        ? 'This site did not publish a Shopify catalog. A link card was added from the page preview.'
        : `Imported ${imported} product${imported === 1 ? '' : 's'}.`),
    shop: payload.shop,
  };
  rememberStoreImport(storeId, result);
  return result;
}

export async function readStoreImportMeta(storeId: string) {
  const { data, error } = await supabase
    .from('stores')
    .select('website_url, import_status, import_error, import_count, imported_at')
    .eq('id', storeId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/** Columns safe to read from the client. Payment secrets live in store_secrets. */
export const STORE_PUBLIC_COLUMNS =
  'id, user_id, name, description, cover_image_url, logo_url, is_active, accepts_credits, accepts_cash, shopify_store_url, website_url, import_status, import_error, import_count, imported_at, peerspace_url, flat_shipping_cents, tax_line_label, tax_line_cents, created_at, updated_at';

export interface StoreItemCategory {
  id: string;
  name: string;
  type: 'product' | 'service' | 'rental';
}

export interface StoreItem {
  id: string;
  store_id: string;
  category_id: string | null;
  type: 'product' | 'service' | 'rental';
  title: string;
  description: string | null;
  price: number;
  credits_price: number;
  currency: string;
  images: string[];
  is_active: boolean;
  inventory_count: number | null;
  duration_minutes: number | null;
  location: string | null;
  amenities: string[] | null;
  contact_email: string | null;
  contact_phone: string | null;
  external_source?: string | null;
  external_handle?: string | null;
  external_url?: string | null;
  created_at: string;
  updated_at: string;
  category?: StoreItemCategory;
  store?: Store & { profile?: { display_name: string; avatar_url: string } };
}

export interface StoreOrder {
  id: string;
  store_id: string;
  buyer_id: string;
  item_id: string;
  quantity: number;
  total_price: number;
  credits_spent: number;
  payment_type: 'cash' | 'credits' | 'hybrid';
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded';
  stripe_payment_intent_id: string | null;
  notes: string | null;
  created_at: string;
  item?: StoreItem;
}

export interface RentalInquiry {
  id: string;
  item_id: string;
  inquirer_id: string;
  message: string;
  preferred_dates: string | null;
  status: 'pending' | 'responded' | 'booked' | 'declined';
  created_at: string;
  item?: StoreItem;
}

// Get current user's store
export const useMyStore = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-store', user?.id],
    queryFn: async () => {
      if (!user) return null;
      if (shotSessionEnabled()) {
        return {
          id: "0412aaaa-0000-4000-8000-000000000042",
          user_id: user.id,
          name: "Shot Store",
          description: null,
          cover_image_url: null,
          logo_url: null,
          is_active: true,
          accepts_credits: true,
          accepts_cash: true,
          shopify_store_url: "nuancebylcove.com",
          website_url: "https://nuancebylcove.com/",
          import_status: null,
          import_error: null,
          import_count: null,
          imported_at: null,
          peerspace_url: null,
          created_at: "2026-10-19T15:00:00.000Z",
          updated_at: "2026-10-19T15:00:00.000Z",
        } satisfies Store;
      }
      const { data, error } = await supabase
        .from('stores')
        .select(STORE_PUBLIC_COLUMNS)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Store | null;
    },
    enabled: !!user,
  });
};

// Get store by user ID
export const useStoreByUser = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['store', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('stores')
        .select(STORE_PUBLIC_COLUMNS)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as Store | null;
    },
    enabled: !!userId,
  });
};

// Get all categories
export const useStoreCategories = () => {
  return useQuery({
    queryKey: ['store-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_item_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as StoreItemCategory[];
    },
  });
};

// Get store items by type
export const useStoreItems = (type?: 'product' | 'service' | 'rental', storeId?: string) => {
  return useQuery({
    queryKey: ['store-items', type, storeId],
    queryFn: async () => {
      let query = supabase
        .from('store_items')
        .select(`
          *,
          category:store_item_categories(*),
          store:stores(${STORE_PUBLIC_COLUMNS})
        `)
        .eq('is_active', true);

      if (type) {
        query = query.eq('type', type);
      }
      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch profiles for each store owner using profiles_public view
      const storeUserIds = [...new Set((data ?? []).flatMap((item) => {
        const store = asStoreRecord(item.store);
        return store ? [store.user_id] : [];
      }))];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', storeUserIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data?.map(item => {
        const store = asStoreRecord(item.store);
        return {
          ...item,
          store: store ? {
            ...store,
            profile: profileMap.get(store.user_id)
          } : undefined
        };
      }) as StoreItem[];
    },
  });
};

// Get single store item
export const useStoreItem = (itemId: string | undefined) => {
  return useQuery({
    queryKey: ['store-item', itemId],
    queryFn: async () => {
      if (!itemId) return null;
      const { data, error } = await supabase
        .from('store_items')
        .select(`
          *,
          category:store_item_categories(*),
          store:stores(${STORE_PUBLIC_COLUMNS})
        `)
        .eq('id', itemId)
        .single();

      if (error) throw error;

      // Fetch profile for store owner using profiles_public view
      const store = asStoreRecord(data?.store);
      if (store) {
        const { data: profile } = await supabase
          .from('profiles_public')
          .select('user_id, display_name, avatar_url')
          .eq('user_id', store.user_id)
          .single();

        return {
          ...data,
          store: {
            ...store,
            profile
          }
        } as StoreItem;
      }

      return data as StoreItem;
    },
    enabled: !!itemId,
  });
};

// Get my store items
export const useMyStoreItems = () => {
  const { data: store } = useMyStore();

  return useQuery({
    queryKey: ['my-store-items', store?.id],
    queryFn: async () => {
      if (!store) return [];
      const { data, error } = await supabase
        .from('store_items')
        .select('*, category:store_item_categories(*)')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StoreItem[];
    },
    enabled: !!store,
  });
};

// Create store
export const useCreateStore = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Partial<Store>) => {
      if (!user) throw new Error('Not authenticated');
      const insertData = {
        name: data.name || 'My Store',
        user_id: user.id,
        description: data.description || null,
        cover_image_url: data.cover_image_url || null,
        logo_url: data.logo_url || null,
        is_active: data.is_active ?? true,
        accepts_credits: data.accepts_credits ?? true,
        accepts_cash: data.accepts_cash ?? true,
        shopify_store_url: data.shopify_store_url || null,
        peerspace_url: data.peerspace_url || null,
        flat_shipping_cents: data.flat_shipping_cents ?? 0,
        tax_line_label: data.tax_line_label || null,
        tax_line_cents: data.tax_line_cents ?? 0,
      };
      const { data: store, error } = await supabase
        .from('stores')
        .insert(insertData as never)
        .select(STORE_PUBLIC_COLUMNS)
        .single();

      if (error) throw error;
      return store;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('Store created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create store: ' + error.message);
    },
  });
};

// Update store
export const useUpdateStore = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Store> & { id: string }) => {
      const { data: store, error } = await supabase
        .from('stores')
        .update(data as never)
        .eq('id', id)
        .select(STORE_PUBLIC_COLUMNS)
        .single();

      if (error) throw error;
      return store;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('Store updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update store: ' + error.message);
    },
  });
};

// Create store item
export const useCreateStoreItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<StoreItem>) => {
      const insertData = {
        store_id: data.store_id!,
        type: data.type!,
        title: data.title!,
        description: data.description || null,
        price: data.price || 0,
        credits_price: data.credits_price || 0,
        currency: data.currency || 'USD',
        images: data.images || [],
        is_active: data.is_active ?? true,
        inventory_count: data.inventory_count || null,
        category_id: data.category_id || null,
        duration_minutes: data.duration_minutes || null,
        location: data.location || null,
        amenities: data.amenities || null,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
      };
      const { data: item, error } = await supabase
        .from('store_items')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-items'] });
      queryClient.invalidateQueries({ queryKey: ['my-store-items'] });
      toast.success('Item added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add item: ' + error.message);
    },
  });
};

// Update store item
export const useUpdateStoreItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<StoreItem> & { id: string }) => {
      const { data: item, error } = await supabase
        .from('store_items')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-items'] });
      queryClient.invalidateQueries({ queryKey: ['my-store-items'] });
      toast.success('Item updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update item: ' + error.message);
    },
  });
};

// Delete store item (soft delete by setting is_active to false)
export const useDeleteStoreItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('store_items')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-items'] });
      queryClient.invalidateQueries({ queryKey: ['my-store-items'] });
      toast.success('Item deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete item: ' + error.message);
    },
  });
};

// Get my orders (as buyer)
export const useMyOrders = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('store_orders')
        .select('*, item:store_items(*)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StoreOrder[];
    },
    enabled: !!user,
  });
};

// Get store orders (as seller)
export const useStoreOrders = () => {
  const { data: store } = useMyStore();

  return useQuery({
    queryKey: ['store-orders', store?.id],
    queryFn: async () => {
      if (!store) return [];
      const { data, error } = await supabase
        .from('store_orders')
        .select('*, item:store_items(*)')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StoreOrder[];
    },
    enabled: !!store,
  });
};

// Create rental inquiry
export const useCreateRentalInquiry = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { item_id: string; message: string; preferred_dates?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data: inquiry, error } = await supabase
        .from('rental_inquiries')
        .insert({ ...data, inquirer_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return inquiry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental-inquiries'] });
      toast.success('Inquiry sent successfully');
    },
    onError: (error) => {
      toast.error('Failed to send inquiry: ' + error.message);
    },
  });
};

// Get my rental inquiries (as store owner)
export const useMyRentalInquiries = () => {
  const { data: store } = useMyStore();

  return useQuery({
    queryKey: ['rental-inquiries', store?.id],
    queryFn: async () => {
      if (!store) return [];
      const { data, error } = await supabase
        .from('rental_inquiries')
        .select('*, item:store_items(*)')
        .eq('item.store_id', store.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RentalInquiry[];
    },
    enabled: !!store,
  });
};
