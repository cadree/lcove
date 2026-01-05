import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
  shopify_access_token: string | null;
  peerspace_url: string | null;
  created_at: string;
  updated_at: string;
}

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
      const { data, error } = await supabase
        .from('stores')
        .select('*')
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
        .select('*')
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
          store:stores(*)
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

      // Fetch profiles for each store owner
      const storeUserIds = [...new Set(data?.map(item => (item.store as any)?.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', storeUserIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return data?.map(item => ({
        ...item,
        store: item.store ? {
          ...(item.store as any),
          profile: profileMap.get((item.store as any).user_id)
        } : undefined
      })) as StoreItem[];
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
          store:stores(*)
        `)
        .eq('id', itemId)
        .single();

      if (error) throw error;

      // Fetch profile for store owner
      if (data?.store) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .eq('user_id', (data.store as any).user_id)
          .single();

        return {
          ...data,
          store: {
            ...(data.store as any),
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
      };
      const { data: store, error } = await supabase
        .from('stores')
        .insert(insertData)
        .select()
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
        .update(data)
        .eq('id', id)
        .select()
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

// Delete store item
export const useDeleteStoreItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('store_items')
        .delete()
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
