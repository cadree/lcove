import React, { useState } from 'react';
import { format } from 'date-fns';
import { X, DollarSign, Calendar, Users, Check, XIcon, Clock, Send, Trash2 } from 'lucide-react';
import { Project, ProjectRole, useProjectApplications, useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface ProjectDetailProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-emerald-500/20 text-emerald-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, open, onClose }) => {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<ProjectRole | null>(null);
  const [applicationMessage, setApplicationMessage] = useState('');
  const { applications, applyToProject, reviewApplication, isApplying } = useProjectApplications(project?.id);
  const { deleteProject, isDeleting } = useProjects();

  if (!project) return null;

  const isCreator = user?.id === project.creator_id;
  const totalRolePayout = project.roles?.reduce((sum, role) => sum + role.payout_amount * role.slots_available, 0) || 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: project.currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleApply = () => {
    if (!selectedRole) return;
    applyToProject({
      projectId: project.id,
      roleId: selectedRole.id,
      message: applicationMessage
    }, {
      onSuccess: () => {
        setSelectedRole(null);
        setApplicationMessage('');
      }
    });
  };

  const hasAppliedToRole = (roleId: string) => {
    return applications.some(a => a.role_id === roleId && a.applicant_id === user?.id);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-y-auto">
        <SheetHeader className="p-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
          <div className="flex items-start justify-between">
            <div>
              <Badge className={cn('mb-2', statusColors[project.status])}>
                {project.status.replace('_', ' ')}
              </Badge>
              <SheetTitle className="text-xl">{project.title}</SheetTitle>
            </div>
            <div className="flex items-center gap-1">
              {isCreator && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="shrink-0 -mt-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Project</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{project.title}"? This will remove all roles and applications. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          try {
                            await deleteProject(project.id);
                            onClose();
                          } catch (e) {
                            console.error('Delete failed:', e);
                          }
                        }}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="shrink-0 -mt-1 -mr-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {/* Creator */}
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={project.creator?.avatar_url || undefined} />
              <AvatarFallback>{project.creator?.display_name?.[0] || '?'}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{project.creator?.display_name || 'Anonymous'}</p>
              <p className="text-xs text-muted-foreground">Project Creator</p>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div>
              <h4 className="text-sm font-medium mb-2">About This Project</h4>
              <p className="text-sm text-muted-foreground">{project.description}</p>
            </div>
          )}

          {/* Budget Breakdown */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Budget Breakdown
              </h4>
              <span className="text-xl font-bold text-primary">{formatCurrency(project.total_budget)}</span>
            </div>

            {/* Visual pie/bar chart */}
            <div className="space-y-2">
              {project.roles?.map((role, index) => {
                const percentage = (role.payout_amount * role.slots_available / project.total_budget) * 100;
                const colors = ['bg-primary', 'bg-blue-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500'];
                return (
                  <div key={role.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-foreground">{role.role_name}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(role.payout_amount)} × {role.slots_available} = {formatCurrency(role.payout_amount * role.slots_available)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", colors[index % colors.length])}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50 text-sm">
              <span className="text-muted-foreground">Total Allocated</span>
              <span className="font-medium">{formatCurrency(totalRolePayout)} / {formatCurrency(project.total_budget)}</span>
            </div>
          </div>

          {/* Timeline */}
          {(project.timeline_start || project.timeline_end) && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Timeline</span>
              </div>
              <span>
                {project.timeline_start && format(new Date(project.timeline_start), 'MMM d, yyyy')}
                {project.timeline_start && project.timeline_end && ' → '}
                {project.timeline_end && format(new Date(project.timeline_end), 'MMM d, yyyy')}
              </span>
            </div>
          )}

          {/* Roles & Applications */}
          <Tabs defaultValue="roles" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="roles" className="flex-1">Roles ({project.roles?.length || 0})</TabsTrigger>
              {isCreator && (
                <TabsTrigger value="applications" className="flex-1">
                  Applications ({applications.filter(a => a.status === 'pending').length})
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="roles" className="mt-4 space-y-3">
              {project.roles?.map((role) => {
                const hasApplied = hasAppliedToRole(role.id);
                const isSelected = selectedRole?.id === role.id;
                
                return (
                  <div
                    key={role.id}
                    className={cn(
                      "border rounded-lg p-4 transition-all",
                      role.is_locked 
                        ? "bg-muted/20 border-muted opacity-60" 
                        : isSelected 
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 cursor-pointer"
                    )}
                    onClick={() => !role.is_locked && !isCreator && !hasApplied && setSelectedRole(isSelected ? null : role)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h5 className="font-medium">{role.role_name}</h5>
                        {role.description && (
                          <p className="text-sm text-muted-foreground">{role.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-primary">{formatCurrency(role.payout_amount)}</span>
                        <p className="text-xs text-muted-foreground">per person</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{role.slots_filled}/{role.slots_available} filled</span>
                      </div>
                      {role.is_locked ? (
                        <Badge variant="secondary">Filled</Badge>
                      ) : hasApplied ? (
                        <Badge className="bg-amber-500/20 text-amber-400">Applied</Badge>
                      ) : !isCreator && (
                        <Badge className={isSelected ? "bg-primary" : "bg-primary/20 text-primary"}>
                          {isSelected ? 'Selected' : 'Click to Apply'}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Application form */}
              {selectedRole && !isCreator && (
                <div className="border border-primary rounded-lg p-4 space-y-3 animate-fade-in">
                  <h5 className="font-medium">Apply for {selectedRole.role_name}</h5>
                  <Textarea
                    value={applicationMessage}
                    onChange={(e) => setApplicationMessage(e.target.value)}
                    placeholder="Introduce yourself and why you're a great fit..."
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleApply} disabled={isApplying} className="flex-1">
                      <Send className="h-4 w-4 mr-2" />
                      {isApplying ? 'Sending...' : 'Submit Application'}
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedRole(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {isCreator && (
              <TabsContent value="applications" className="mt-4 space-y-3">
                {applications.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No applications yet</p>
                ) : (
                  applications.map((app) => (
                    <div key={app.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={app.applicant?.avatar_url || undefined} />
                            <AvatarFallback>{app.applicant?.display_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{app.applicant?.display_name || 'Anonymous'}</p>
                            <p className="text-xs text-muted-foreground">
                              Applied for {app.role?.role_name} • {format(new Date(app.created_at), 'MMM d')}
                            </p>
                          </div>
                        </div>
                        <Badge className={cn(
                          app.status === 'pending' && 'bg-amber-500/20 text-amber-400',
                          app.status === 'accepted' && 'bg-emerald-500/20 text-emerald-400',
                          app.status === 'rejected' && 'bg-red-500/20 text-red-400'
                        )}>
                          {app.status}
                        </Badge>
                      </div>

                      {app.message && (
                        <p className="text-sm text-muted-foreground mb-3 bg-muted/30 rounded p-2">
                          "{app.message}"
                        </p>
                      )}

                      {app.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => reviewApplication({ applicationId: app.id, status: 'accepted' })}
                            className="flex-1"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reviewApplication({ applicationId: app.id, status: 'rejected' })}
                            className="flex-1"
                          >
                            <XIcon className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};
