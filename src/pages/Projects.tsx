import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, FolderKanban, Filter, Rocket, Lightbulb, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import PageLayout from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useProjects, Project } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectDetail } from '@/components/projects/ProjectDetail';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectJoinEnergy } from '@/hooks/useProjectJoinEnergy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const Projects: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState('all');
  const { projects, myProjects, isLoading } = useProjects(statusFilter);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Check and award energy for accepted project applications
  useProjectJoinEnergy();

  // Fetch client projects (projects where user is an invited/accepted client)
  const { data: clientProjects = [] } = useQuery({
    queryKey: ['client-projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Get project IDs where user is client
      const { data: clientRows } = await (supabase
        .from('project_clients') as any)
        .select('project_id')
        .eq('client_user_id', user.id)
        .in('status', ['invited', 'accepted']);

      if (!clientRows || clientRows.length === 0) return [];

      const projectIds = clientRows.map((r: any) => r.project_id);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ids = data.map(p => p.id);
      const { data: roles } = await supabase
        .from('project_roles')
        .select('*')
        .in('project_id', ids);

      const creatorIds = [...new Set(data.map(p => p.creator_id))];
      const { data: profiles } = await supabase
        .from('profiles_public')
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
    enabled: !!user?.id,
  });

  // Handle action params from FAB
  useEffect(() => {
    if (searchParams.get('action') === 'create' && user) {
      setCreateDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, user, setSearchParams]);

  // Handle open param from shared links
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && !isLoading) {
      const allProjects = [...projects, ...myProjects];
      const found = allProjects.find(p => p.id === openId);
      if (found) {
        setSelectedProject(found);
        setDetailOpen(true);
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, projects, myProjects, isLoading, setSearchParams]);

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setDetailOpen(true);
  };

  return (
    <PageLayout>
      <div className="p-4 sm:p-6 pb-32 touch-manipulation">
        {/* Header */}
        <PageHeader
          title="Projects"
          description="Find collaborators, share budgets transparently"
          icon={<FolderKanban className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
          backPath="/"
          actions={
            user && (
              <CreateProjectDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <Button data-create-project onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </CreateProjectDialog>
            )
          }
          className="mb-8"
        />

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs defaultValue="browse" className="w-full">
            <TabsList className="w-full max-w-lg mb-8">
              <TabsTrigger value="browse" className="flex-1">Browse</TabsTrigger>
              {user && <TabsTrigger value="my-projects" className="flex-1">My Projects</TabsTrigger>}
              {user && <TabsTrigger value="client-projects" className="flex-1 gap-1"><Lock className="h-3 w-3" />Client</TabsTrigger>}
            </TabsList>

            <TabsContent value="browse">
              {/* Status Filter */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide"
              >
                <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                {['all', 'open', 'in_progress', 'completed'].map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className="flex-shrink-0 capitalize"
                  >
                    {status === 'all' ? 'All' : status.replace('_', ' ')}
                  </Button>
                ))}
              </motion.div>

              {/* Projects Grid */}
              {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-64 rounded-2xl" />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <EmptyState
                  icon={Rocket}
                  title="No projects yet"
                  description="Great ideas need great teams. Start a project and find the collaborators who'll help bring your vision to life."
                  action={user ? {
                    label: "Start a Project",
                    onClick: () => document.querySelector<HTMLButtonElement>('[data-create-project]')?.click()
                  } : undefined}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project, index) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <ProjectCard
                        project={project}
                        onClick={() => handleProjectClick(project)}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            {user && (
              <TabsContent value="my-projects">
                {myProjects.length === 0 ? (
                  <EmptyState
                    icon={Lightbulb}
                    title="Your creative journey awaits"
                    description="Every great project starts with an idea. Share yours and discover who wants to help make it real."
                    action={{
                      label: "Create Your First Project",
                      onClick: () => document.querySelector<HTMLButtonElement>('[data-create-project]')?.click()
                    }}
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {myProjects.map((project, index) => (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <ProjectCard
                          project={project}
                          onClick={() => handleProjectClick(project)}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </motion.div>

        {/* Project Detail Sheet */}
        <ProjectDetail
          project={selectedProject}
          open={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setSelectedProject(null);
          }}
        />
      </div>
    </PageLayout>
  );
};

export default Projects;
