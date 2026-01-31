import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PartnerApplication {
  id: string;
  user_id: string;
  business_name: string;
  category: string;
  description: string | null;
  contribution: string | null;
  member_benefits: string | null;
  website_url: string | null;
  contact_email: string;
  contact_phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export function usePartnerApplications(status?: 'pending' | 'accepted' | 'rejected') {
  return useQuery({
    queryKey: ['partner-applications', status],
    queryFn: async () => {
      let query = supabase
        .from('partner_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PartnerApplication[];
    },
  });
}

export function useAcceptPartnerApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      applicationId, 
      partnershipType 
    }: { 
      applicationId: string; 
      partnershipType: 'sponsor' | 'collaborator' | 'supporter';
    }) => {
      // Get the application details
      const { data: application, error: appError } = await supabase
        .from('partner_applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (appError) throw appError;

      // Update application status
      const { error: updateError } = await supabase
        .from('partner_applications')
        .update({
          status: 'accepted',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (updateError) throw updateError;

      // Create brand partnership entry
      const { error: partnerError } = await supabase
        .from('brand_partnerships')
        .insert({
          brand_name: application.business_name,
          description: application.description,
          partnership_type: partnershipType,
          website_url: application.website_url,
          contact_email: application.contact_email,
          exclusive_offer: application.member_benefits,
          owner_user_id: application.user_id,
          application_id: applicationId,
          address: application.address,
          city: application.city,
          state: application.state,
          country: application.country,
          is_active: false, // Not active until partner customizes their profile
        });

      if (partnerError) throw partnerError;

      // Send acceptance email via edge function
      const { error: emailError } = await supabase.functions.invoke('notify-partner-accepted', {
        body: {
          applicationId,
          email: application.contact_email,
          businessName: application.business_name,
        },
      });

      if (emailError) {
        console.error('Failed to send acceptance email:', emailError);
        // Don't throw - the acceptance was successful, just email failed
      }

      return application;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-applications'] });
      queryClient.invalidateQueries({ queryKey: ['brand-partnerships'] });
      toast.success('Partner application accepted! They will receive an email to customize their profile.');
    },
    onError: (error: any) => {
      toast.error('Failed to accept application: ' + error.message);
    },
  });
}

export function useRejectPartnerApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      applicationId, 
      reason 
    }: { 
      applicationId: string; 
      reason: string;
    }) => {
      const { error } = await supabase
        .from('partner_applications')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-applications'] });
      toast.success('Partner application rejected');
    },
    onError: (error: any) => {
      toast.error('Failed to reject application: ' + error.message);
    },
  });
}
