import React, { useState } from 'react';
import { Plus, FolderKanban, Filter, Rocket, Lightbulb } from 'lucide-react';
import { motion } from 'framer-motion';
import PageLayout from '@/components/layout/PageLayout';
import { useProjects, Project } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectDetail } from '@/components/projects/ProjectDetail';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

const Projects: React.FC = () => {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const { projects, myProjects, isLoading } = useProjects(statusFilter);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setDetailOpen(true);
  };

  return (
    <PageLayout>
      <div className="p-4 sm:p-6 pb-32">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-medium text-foreground">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">Find collaborators, share budgets transparently</p>
          </div>
          {user && (
            <CreateProjectDialog>
              <Button data-create-project>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </CreateProjectDialog>
          )}
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs defaultValue="browse" className="w-full">
            <TabsList className="w-full max-w-md mb-6">
              <TabsTrigger value="browse" className="flex-1">Browse Projects</TabsTrigger>
              {user && <TabsTrigger value="my-projects" className="flex-1">My Projects</TabsTrigger>}
            </TabsList>

            <TabsContent value="browse">
              {/* Status Filter */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide"
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
          onClose={() => setDetailOpen(false)}
        />
      </div>
    </PageLayout>
  );
};

export default Projects;
