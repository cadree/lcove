import React, { useState } from 'react';
import { Plus, FolderKanban, Filter } from 'lucide-react';
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold">Projects</h1>
            <p className="text-sm text-muted-foreground">Find collaborators, share budgets transparently</p>
          </div>
          {user && (
            <CreateProjectDialog>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </CreateProjectDialog>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="browse" className="w-full">
          <TabsList className="w-full max-w-md mb-6">
            <TabsTrigger value="browse" className="flex-1">Browse Projects</TabsTrigger>
            {user && <TabsTrigger value="my-projects" className="flex-1">My Projects</TabsTrigger>}
          </TabsList>

          <TabsContent value="browse">
            {/* Status Filter */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              {['all', 'open', 'in_progress', 'completed'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className="flex-shrink-0"
                >
                  {status === 'all' ? 'All' : status.replace('_', ' ')}
                </Button>
              ))}
            </div>

            {/* Projects Grid */}
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-64 rounded-xl" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderKanban className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-1">No projects found</h3>
                <p className="text-sm text-muted-foreground mb-4">
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
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => handleProjectClick(project)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {user && (
            <TabsContent value="my-projects">
              {myProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderKanban className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium mb-1">No projects yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first project to start collaborating
                  </p>
                  <CreateProjectDialog>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Project
                    </Button>
                  </CreateProjectDialog>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {myProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onClick={() => handleProjectClick(project)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>

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
