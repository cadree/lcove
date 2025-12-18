import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type PartnerCategory = 'studio' | 'venue' | 'cafe' | 'housing' | 'equipment' | 'transport' | 'service' | 'other';

export interface Partner {
  id: string;
  name: string;
  category: PartnerCategory;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  member_benefits: string | null;
  terms: string | null;
  is_active: boolean;
  is_verified: boolean;
  owner_user_id: string | null;
  display_order: number;
  created_at: string;
}

export function usePartners(filters?: { category?: PartnerCategory; city?: string }) {
  return useQuery({
    queryKey: ['partners', filters],
    queryFn: async () => {
      let query = supabase
        .from('partners')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.city) {
        query = query.ilike('city', `%${filters.city}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Partner[];
    },
  });
}

export function usePartner(partnerId: string) {
  return useQuery({
    queryKey: ['partner', partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('id', partnerId)
        .single();

      if (error) throw error;
      return data as Partner;
    },
    enabled: !!partnerId,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<Partner, 'id' | 'created_at' | 'is_active' | 'is_verified' | 'display_order'>) => {
      const { data: partner, error } = await supabase
        .from('partners')
        .insert({
          ...data,
          owner_user_id: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return partner;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success('Partner profile created');
    },
    onError: () => {
      toast.error('Failed to create partner profile');
    },
  });
}

export function useUpdatePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string } & Partial<Partner>) => {
      const { id, ...updateData } = data;
      const { error } = await supabase
        .from('partners')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      queryClient.invalidateQueries({ queryKey: ['partner', variables.id] });
      toast.success('Partner profile updated');
    },
  });
}

export function usePartnerCategories() {
  return [
    { value: 'studio', label: 'Studio', icon: '🎬' },
    { value: 'venue', label: 'Venue', icon: '🏛️' },
    { value: 'cafe', label: 'Café', icon: '☕' },
    { value: 'housing', label: 'Housing', icon: '🏠' },
    { value: 'equipment', label: 'Equipment', icon: '📷' },
    { value: 'transport', label: 'Transport', icon: '🚗' },
    { value: 'service', label: 'Service', icon: '✨' },
    { value: 'other', label: 'Other', icon: '📦' },
  ] as const;
}
