import React, { useState } from 'react';
import { Plus, FolderKanban, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import PageLayout from '@/components/layout/PageLayout';
import { useProjects, Project } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectDetail } from '@/components/projects/ProjectDetail';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
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
              <Button>
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
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center glass-strong rounded-2xl"
                >
                  <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-5">
                    <FolderKanban className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-medium mb-2 text-foreground">No projects found</h3>
                  <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                    Be the first to create a project and find collaborators
                  </p>
                  {user && (
                    <CreateProjectDialog>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Project
                      </Button>
                    </CreateProjectDialog>
                  )}
                </motion.div>
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
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-20 text-center glass-strong rounded-2xl"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-5">
                      <FolderKanban className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-medium mb-2 text-foreground">No projects yet</h3>
                    <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                      Create your first project to start collaborating
                    </p>
                    <CreateProjectDialog>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Project
                      </Button>
                    </CreateProjectDialog>
                  </motion.div>
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
