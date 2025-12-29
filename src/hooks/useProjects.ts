import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Project {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  total_budget: number;
  currency: string;
  timeline_start: string | null;
  timeline_end: string | null;
  status: 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled';
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  roles?: ProjectRole[];
  creator?: { display_name: string | null; avatar_url: string | null };
}

export interface ProjectRole {
  id: string;
  project_id: string;
  role_name: string;
  description: string | null;
  payout_amount: number;
  slots_available: number;
  slots_filled: number;
  is_locked: boolean;
  created_at: string;
}

export interface ProjectApplication {
  id: string;
  project_id: string;
  role_id: string;
  applicant_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  message: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  applicant?: { display_name: string | null; avatar_url: string | null };
  role?: ProjectRole;
}

export const useProjects = (status?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', status],
    queryFn: async () => {
      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      } else {
        query = query.in('status', ['open', 'in_progress', 'completed']);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch roles for each project
      const projectIds = data.map(p => p.id);
      const { data: roles } = await supabase
        .from('project_roles')
        .select('*')
        .in('project_id', projectIds);

      // Fetch creator profiles
      const creatorIds = [...new Set(data.map(p => p.creator_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', creatorIds);

      return data.map(project => ({
        ...project,
        total_budget: Number(project.total_budget),
        roles: roles?.filter(r => r.project_id === project.id).map(r => ({
          ...r,
          payout_amount: Number(r.payout_amount)
        })) || [],
        creator: profiles?.find(p => p.user_id === project.creator_id)
      })) as Project[];
    },
  });

  const { data: myProjects = [] } = useQuery({
    queryKey: ['my-projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const projectIds = data.map(p => p.id);
      const { data: roles } = await supabase
        .from('project_roles')
        .select('*')
        .in('project_id', projectIds);

      return data.map(project => ({
        ...project,
        total_budget: Number(project.total_budget),
        roles: roles?.filter(r => r.project_id === project.id).map(r => ({
          ...r,
          payout_amount: Number(r.payout_amount)
        })) || []
      })) as Project[];
    },
    enabled: !!user?.id,
  });

  const createProject = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      total_budget: number;
      currency?: string;
      timeline_start?: string;
      timeline_end?: string;
      cover_image_url?: string;
      roles: { role_name: string; description?: string; payout_amount: number; slots_available: number }[];
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          creator_id: user.id,
          title: data.title,
          description: data.description,
          total_budget: data.total_budget,
          currency: data.currency || 'USD',
          timeline_start: data.timeline_start,
          timeline_end: data.timeline_end,
          cover_image_url: data.cover_image_url,
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;

      // Create roles
      if (data.roles.length > 0) {
        const { error: rolesError } = await supabase
          .from('project_roles')
          .insert(data.roles.map(role => ({
            project_id: project.id,
            role_name: role.role_name,
            description: role.description,
            payout_amount: role.payout_amount,
            slots_available: role.slots_available
          })));

        if (rolesError) throw rolesError;
      }

      // Get creator name for notification
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      // Notify opted-in users about the new project
      supabase.functions.invoke('notify-new-content', {
        body: {
          content_type: 'project',
          content_id: project.id,
          title: data.title,
          description: data.description,
          creator_name: profile?.display_name || 'A creator'
        }
      }).catch(err => console.error('Failed to send new project notifications:', err));

      return project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
      toast({ title: 'Project created successfully!' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create project', description: error.message, variant: 'destructive' });
    },
  });

  const updateProjectStatus = useMutation({
    mutationFn: async ({ projectId, status }: { projectId: string; status: string }) => {
      const { error } = await supabase
        .from('projects')
        .update({ status })
        .eq('id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['my-projects'] });
    },
  });

  return {
    projects,
    myProjects,
    isLoading,
    createProject: createProject.mutate,
    updateProjectStatus: updateProjectStatus.mutate,
    isCreating: createProject.isPending,
  };
};

export const useProjectApplications = (projectId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['project-applications', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('project_applications')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch applicant profiles
      const applicantIds = [...new Set(data.map(a => a.applicant_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', applicantIds);

      // Fetch roles
      const roleIds = [...new Set(data.map(a => a.role_id))];
      const { data: roles } = await supabase
        .from('project_roles')
        .select('*')
        .in('id', roleIds);

      return data.map(app => ({
        ...app,
        applicant: profiles?.find(p => p.user_id === app.applicant_id),
        role: roles?.find(r => r.id === app.role_id)
      })) as ProjectApplication[];
    },
    enabled: !!projectId,
  });

  const { data: myApplications = [] } = useQuery({
    queryKey: ['my-applications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('project_applications')
        .select('*')
        .eq('applicant_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ProjectApplication[];
    },
    enabled: !!user?.id,
  });

  const applyToProject = useMutation({
    mutationFn: async ({ projectId, roleId, message }: { projectId: string; roleId: string; message?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('project_applications')
        .insert({
          project_id: projectId,
          role_id: roleId,
          applicant_id: user.id,
          message
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-applications'] });
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      toast({ title: 'Application submitted!' });
    },
    onError: (error) => {
      toast({ title: 'Failed to apply', description: error.message, variant: 'destructive' });
    },
  });

  const reviewApplication = useMutation({
    mutationFn: async ({ applicationId, status, projectTitle, roleTitle }: { 
      applicationId: string; 
      status: 'accepted' | 'rejected';
      projectTitle?: string;
      roleTitle?: string;
    }) => {
      // Get application details first
      const { data: application, error: appError } = await supabase
        .from('project_applications')
        .select('applicant_id, project_id, role_id')
        .eq('id', applicationId)
        .single();

      if (appError) throw appError;

      const { error } = await supabase
        .from('project_applications')
        .update({ status, reviewed_by: user?.id })
        .eq('id', applicationId);

      if (error) throw error;

      // If accepted, send notification
      if (status === 'accepted' && application) {
        // Get project and role details if not provided
        let finalProjectTitle = projectTitle;
        let finalRoleTitle = roleTitle;

        if (!finalProjectTitle || !finalRoleTitle) {
          const { data: project } = await supabase
            .from('projects')
            .select('title')
            .eq('id', application.project_id)
            .single();
          
          const { data: role } = await supabase
            .from('project_roles')
            .select('role_name')
            .eq('id', application.role_id)
            .single();

          finalProjectTitle = project?.title || 'a project';
          finalRoleTitle = role?.role_name || 'a role';
        }

        // Send acceptance notification
        supabase.functions.invoke('notify-application-accepted', {
          body: {
            applicant_id: application.applicant_id,
            project_id: application.project_id,
            project_title: finalProjectTitle,
            role_title: finalRoleTitle
          }
        }).catch(err => console.error('Failed to send acceptance notification:', err));
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['project-applications'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: status === 'accepted' ? 'Application accepted!' : 'Application rejected' });
    },
    onError: (error) => {
      toast({ title: 'Failed to review application', description: error.message, variant: 'destructive' });
    },
  });

  return {
    applications,
    myApplications,
    isLoading,
    applyToProject: applyToProject.mutate,
    reviewApplication: reviewApplication.mutate,
    isApplying: applyToProject.isPending,
  };
};
