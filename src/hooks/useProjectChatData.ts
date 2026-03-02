import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProjectChatData {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  status: string;
  timeline_start: string | null;
  timeline_end: string | null;
  total_budget: number;
  budget_range: string | null;
  currency: string;
  venue: string | null;
  equipment_needed: string | null;
  props_needed: string | null;
  vendors_needed: boolean;
  sponsorship_needed: boolean;
  deliverables: any[] | null;
  expected_outcome: string | null;
  creator_id: string;
  progress_percent: number;
  roles: {
    id: string;
    role_name: string;
    description: string | null;
    slots_available: number;
    slots_filled: number;
    is_locked: boolean;
  }[];
  milestones: {
    id: string;
    title: string;
    status: string;
    due_date: string | null;
    phase: string | null;
  }[];
  attachments: {
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
  }[];
}

export function useProjectChatData(projectId?: string | null) {
  return useQuery({
    queryKey: ['project-chat-data', projectId],
    queryFn: async (): Promise<ProjectChatData | null> => {
      if (!projectId) return null;

      // Fetch project, roles, milestones, and attachments in parallel
      const [projectRes, rolesRes, milestonesRes, attachmentsRes] = await Promise.all([
        supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single(),
        supabase
          .from('project_roles')
          .select('id, role_name, description, slots_available, slots_filled, is_locked')
          .eq('project_id', projectId),
        supabase
          .from('project_milestones')
          .select('id, title, status, due_date, phase')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true }),
        (supabase.from('project_attachments') as any)
          .select('id, file_url, file_name, file_type')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(12),
      ]);

      if (projectRes.error || !projectRes.data) return null;

      const p = projectRes.data;
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        cover_image_url: p.cover_image_url,
        status: p.status,
        timeline_start: p.timeline_start,
        timeline_end: p.timeline_end,
        total_budget: Number(p.total_budget),
        budget_range: p.budget_range,
        currency: p.currency,
        venue: p.venue,
        equipment_needed: p.equipment_needed,
        props_needed: p.props_needed,
        vendors_needed: p.vendors_needed ?? false,
        sponsorship_needed: p.sponsorship_needed ?? false,
        deliverables: p.deliverables as any[] | null,
        expected_outcome: p.expected_outcome,
        creator_id: p.creator_id,
        progress_percent: p.progress_percent ?? 0,
        roles: rolesRes.data || [],
        milestones: milestonesRes.data || [],
        attachments: attachmentsRes.data || [],
      };
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}
