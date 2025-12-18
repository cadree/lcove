import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BrandPartnership {
  id: string;
  brand_name: string;
  brand_logo_url: string | null;
  description: string | null;
  partnership_type: 'sponsor' | 'collaborator' | 'supporter';
  website_url: string | null;
  is_active: boolean;
  display_order: number;
}

export function useBrandPartnerships() {
  return useQuery({
    queryKey: ['brand-partnerships'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_partnerships')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as BrandPartnership[];
    },
  });
}
