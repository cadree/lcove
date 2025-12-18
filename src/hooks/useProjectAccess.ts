import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Check if user is an accepted member of a project
 * Used to control access to advanced features like escrow details
 */
export function useIsProjectMember(projectId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['project-membership', projectId, user?.id],
    queryFn: async () => {
      if (!projectId || !user?.id) return false;

      // Check if user is project creator
      const { data: project } = await supabase
        .from('projects')
        .select('creator_id')
        .eq('id', projectId)
        .single();

      if (project?.creator_id === user.id) return true;

      // Check if user has an accepted application
      const { data: application } = await supabase
        .from('project_applications')
        .select('status')
        .eq('project_id', projectId)
        .eq('applicant_id', user.id)
        .eq('status', 'accepted')
        .maybeSingle();

      return !!application;
    },
    enabled: !!projectId && !!user?.id,
  });
}

/**
 * Get user's active projects (where they're accepted members)
 */
export function useUserActiveProjects() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-active-projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get projects where user is creator
      const { data: createdProjects } = await supabase
        .from('projects')
        .select('id, title, status')
        .eq('creator_id', user.id)
        .in('status', ['open', 'in_progress']);

      // Get projects where user is accepted collaborator
      const { data: acceptedApplications } = await supabase
        .from('project_applications')
        .select(`
          project_id,
          projects!inner(id, title, status)
        `)
        .eq('applicant_id', user.id)
        .eq('status', 'accepted');

      const collaboratorProjects = acceptedApplications?.map(app => ({
        id: (app.projects as any).id,
        title: (app.projects as any).title,
        status: (app.projects as any).status,
      })) || [];

      return [...(createdProjects || []), ...collaboratorProjects];
    },
    enabled: !!user?.id,
  });
}
