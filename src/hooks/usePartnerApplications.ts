import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PartnerCategory } from './usePartners';

interface PartnerApplicationData {
  user_id: string;
  business_name: string;
  category: PartnerCategory;
  description: string;
  contribution: string;
  member_benefits: string;
  website_url: string | null;
  contact_email: string;
  contact_phone: string | null;
  city: string;
  state: string | null;
  country: string;
  address: string | null;
}

export function useCreatePartnerApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PartnerApplicationData) => {
      const { data: application, error } = await supabase
        .from('partner_applications')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return application;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-applications'] });
      toast.success('Application submitted! We\'ll review it and get back to you soon.');
    },
    onError: (error: any) => {
      if (error?.code === '23505') {
        toast.error('You already have a pending application');
      } else {
        toast.error('Failed to submit application');
      }
    },
  });
}
