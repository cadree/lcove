import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Json } from "@/integrations/supabase/types";

interface AdditionalParty {
  name: string;
  role: string;
  address: string;
  email: string;
  phone: string;
}

export interface ContactContract {
  id: string;
  pipeline_item_id: string;
  owner_user_id: string;
  contract_number: string;
  title: string;
  status: 'draft' | 'sent' | 'signed' | 'completed' | 'cancelled';
  
  // Parties
  provider_name: string | null;
  provider_address: string | null;
  provider_email: string | null;
  provider_phone: string | null;
  client_name: string | null;
  client_address: string | null;
  client_email: string | null;
  client_phone: string | null;
  additional_parties: AdditionalParty[] | null;
  
  // Scope
  scope_description: string | null;
  deliverables: string | null;
  timeline_milestones: string | null;
  exclusions: string | null;
  revisions_included: number;
  revision_cost: number | null;
  
  // Payment
  total_price: number | null;
  payment_type: 'flat_fee' | 'hourly' | 'retainer' | 'milestone' | null;
  payment_schedule: string | null;
  payment_methods: string | null;
  late_fee_percentage: number | null;
  refund_policy: string | null;
  
  // Timeline
  project_start_date: string | null;
  estimated_completion_date: string | null;
  client_responsibilities: string | null;
  
  // IP
  ownership_before_payment: string | null;
  ownership_after_payment: string | null;
  portfolio_rights: boolean;
  
  // Confidentiality
  confidentiality_enabled: boolean;
  confidentiality_duration: string | null;
  confidentiality_terms: string | null;
  
  // Termination
  termination_notice_days: number;
  termination_terms: string | null;
  early_termination_fee: number | null;
  
  // Legal
  limitation_of_liability: string | null;
  indemnification_terms: string | null;
  governing_law_state: string | null;
  governing_law_country: string;
  
  // Force Majeure
  force_majeure_enabled: boolean;
  force_majeure_terms: string | null;
  
  // Signatures
  provider_signature_url: string | null;
  provider_signed_at: string | null;
  client_signature_url: string | null;
  client_signed_at: string | null;
  
  // Sending
  sent_at: string | null;
  sent_via: 'email' | 'sms' | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ContractCreateInput = Omit<ContactContract, 
  'id' | 'pipeline_item_id' | 'owner_user_id' | 'contract_number' | 'status' | 
  'provider_signature_url' | 'provider_signed_at' | 'client_signature_url' | 'client_signed_at' |
  'sent_at' | 'sent_via' | 'recipient_email' | 'recipient_phone' | 'pdf_url' | 'created_at' | 'updated_at'
>;

export function useContactContracts(pipelineItemId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contact-contracts', pipelineItemId],
    queryFn: async () => {
      if (!pipelineItemId) return [];
      const { data, error } = await supabase
        .from('contact_contracts')
        .select('*')
        .eq('pipeline_item_id', pipelineItemId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      // Transform the data to properly type additional_parties
      return (data || []).map(contract => ({
        ...contract,
        additional_parties: (contract.additional_parties as unknown as AdditionalParty[] | null) || [],
      })) as ContactContract[];
    },
    enabled: !!user && !!pipelineItemId,
  });

  const generateContractNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `CTR-${year}${month}-${random}`;
  };

  const createContract = useMutation({
    mutationFn: async (contract: Partial<ContractCreateInput> & { title: string; additional_parties?: AdditionalParty[] }) => {
      if (!user || !pipelineItemId) throw new Error("Not authenticated");

      const insertData = {
        pipeline_item_id: pipelineItemId,
        owner_user_id: user.id,
        contract_number: generateContractNumber(),
        title: contract.title,
        status: 'draft' as const,
        provider_name: contract.provider_name || null,
        provider_address: contract.provider_address || null,
        provider_email: contract.provider_email || null,
        provider_phone: contract.provider_phone || null,
        client_name: contract.client_name || null,
        client_address: contract.client_address || null,
        client_email: contract.client_email || null,
        client_phone: contract.client_phone || null,
        additional_parties: (contract.additional_parties || []) as unknown as Json,
        scope_description: contract.scope_description || null,
        deliverables: contract.deliverables || null,
        timeline_milestones: contract.timeline_milestones || null,
        exclusions: contract.exclusions || null,
        revisions_included: contract.revisions_included ?? 2,
        revision_cost: contract.revision_cost || null,
        total_price: contract.total_price || null,
        payment_type: contract.payment_type || null,
        payment_schedule: contract.payment_schedule || null,
        payment_methods: contract.payment_methods || null,
        late_fee_percentage: contract.late_fee_percentage || null,
        refund_policy: contract.refund_policy || null,
        project_start_date: contract.project_start_date || null,
        estimated_completion_date: contract.estimated_completion_date || null,
        client_responsibilities: contract.client_responsibilities || null,
        ownership_before_payment: contract.ownership_before_payment || 'Provider retains ownership until paid in full',
        ownership_after_payment: contract.ownership_after_payment || 'Client receives full rights after payment',
        portfolio_rights: contract.portfolio_rights ?? true,
        confidentiality_enabled: contract.confidentiality_enabled ?? false,
        confidentiality_duration: contract.confidentiality_duration || null,
        confidentiality_terms: contract.confidentiality_terms || null,
        termination_notice_days: contract.termination_notice_days ?? 14,
        termination_terms: contract.termination_terms || null,
        early_termination_fee: contract.early_termination_fee || null,
        limitation_of_liability: contract.limitation_of_liability || null,
        indemnification_terms: contract.indemnification_terms || null,
        governing_law_state: contract.governing_law_state || null,
        governing_law_country: contract.governing_law_country || 'USA',
        force_majeure_enabled: contract.force_majeure_enabled ?? false,
        force_majeure_terms: contract.force_majeure_terms || null,
      };

      const { data, error } = await supabase
        .from('contact_contracts')
        .insert(insertData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-contracts', pipelineItemId] });
    },
  });

  const updateContract = useMutation({
    mutationFn: async ({ contractId, updates }: { contractId: string; updates: Partial<ContactContract> }) => {
      // Convert additional_parties if present
      const dbUpdates: Record<string, unknown> = { 
        ...updates, 
        updated_at: new Date().toISOString() 
      };
      if (updates.additional_parties) {
        dbUpdates.additional_parties = updates.additional_parties as unknown as Json;
      }
      
      const { error } = await supabase
        .from('contact_contracts')
        .update(dbUpdates)
        .eq('id', contractId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-contracts', pipelineItemId] });
    },
  });

  const signContract = useMutation({
    mutationFn: async ({ contractId, signatureUrl }: { contractId: string; signatureUrl: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from('contact_contracts')
        .update({
          provider_signature_url: signatureUrl,
          provider_signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', contractId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-contracts', pipelineItemId] });
    },
  });

  const sendContract = useMutation({
    mutationFn: async ({ contractId, via, recipient }: { 
      contractId: string; 
      via: 'email' | 'sms'; 
      recipient: string;
    }) => {
      // Update contract status
      const { error } = await supabase
        .from('contact_contracts')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_via: via,
          [via === 'email' ? 'recipient_email' : 'recipient_phone']: recipient,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contractId);
      
      if (error) throw error;

      // Call edge function to send the contract - pass current origin for signing URL
      const appUrl = window.location.origin;
      const { error: sendError } = await supabase.functions.invoke('send-contract', {
        body: { contractId, via, recipient, appUrl },
      });
      
      if (sendError) {
        console.error('Failed to send contract:', sendError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-contracts', pipelineItemId] });
    },
  });

  const deleteContract = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase
        .from('contact_contracts')
        .delete()
        .eq('id', contractId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-contracts', pipelineItemId] });
    },
  });

  return {
    contracts,
    isLoading,
    createContract: createContract.mutateAsync,
    updateContract: updateContract.mutateAsync,
    signContract: signContract.mutateAsync,
    sendContract: sendContract.mutateAsync,
    deleteContract: deleteContract.mutateAsync,
    isCreating: createContract.isPending,
    isSending: sendContract.isPending,
  };
}
