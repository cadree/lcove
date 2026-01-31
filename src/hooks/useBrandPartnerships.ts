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
  // Extended fields for brand partner page
  about_business: string | null;
  exclusive_offer: string | null;
  offer_code: string | null;
  offer_terms: string | null;
  social_links: Record<string, string> | null;
  contact_email: string | null;
  featured: boolean;
}

export function useBrandPartnerships(filter?: 'sponsor' | 'collaborator' | 'supporter') {
  return useQuery({
    queryKey: ['brand-partnerships', filter],
    queryFn: async () => {
      let query = supabase
        .from('brand_partnerships')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (filter) {
        query = query.eq('partnership_type', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as BrandPartnership[];
    },
  });
}
