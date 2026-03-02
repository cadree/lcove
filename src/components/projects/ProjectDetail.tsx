import React, { useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, DollarSign, Calendar, Users, Check, XIcon, Clock, Send, Trash2, Download, FileText, Film, Package, Link, MapPin, Wrench, Target, BarChart3, MessageSquare } from 'lucide-react';
import { Project, ProjectRole, useProjectApplications, useProjects } from '@/hooks/useProjects';
import { useProjectAttachments } from '@/hooks/useProjectAttachments';
import { useProjectUpdates } from '@/hooks/useProjectUpdates';
import { useProjectMilestones } from '@/hooks/useProjectMilestones';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
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
  const [customRoleName, setCustomRoleName] = useState('');
  const [updateContent, setUpdateContent] = useState('');
  const { applications, applyToProject, reviewApplication, isApplying } = useProjectApplications(project?.id);
  const { deleteProject, isDeleting, updateProjectProgress } = useProjects();
  const { attachments } = useProjectAttachments(project?.id);
  const { updates, addUpdate, isPosting } = useProjectUpdates(project?.id);
  const { data: milestones = [] } = useProjectMilestones(project?.id);

  if (!project) return null;

  const isCreator = user?.id === project.creator_id;
  const totalRolePayout = project.roles?.reduce((sum, role) => sum + role.payout_amount * role.slots_available, 0) || 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: project.currency, minimumFractionDigits: 0 }).format(amount);
  };

  const handleApply = () => {
    if (!selectedRole) return;
    applyToProject({ projectId: project.id, roleId: selectedRole.id, message: applicationMessage }, {
      onSuccess: () => { setSelectedRole(null); setApplicationMessage(''); }
    });
  };

  const hasAppliedToRole = (roleId: string) => applications.some(a => a.role_id === roleId && a.applicant_id === user?.id);

  const handlePostUpdate = () => {
    if (!updateContent.trim() || !project.id) return;
    addUpdate({ projectId: project.id, content: updateContent });
    setUpdateContent('');
  };

  const fileTypeIcon = (type: string) => {
    if (type === 'pdf') return <FileText className="h-5 w-5 text-red-400" />;
    if (type === 'video') return <Film className="h-5 w-5 text-purple-400" />;
    if (type === 'zip') return <Package className="h-5 w-5 text-emerald-400" />;
    if (type === 'link') return <Link className="h-5 w-5 text-cyan-400" />;
    return <FileText className="h-5 w-5 text-amber-400" />;
  };

  const outcomeLabels = project.expected_outcome?.split(', ').filter(Boolean) || [];
  const deliverables = (project.deliverables as any[]) || [];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-y-auto pb-safe touch-manipulation">
        <SheetHeader className="p-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn(statusColors[project.status])}>{project.status.replace('_', ' ')}</Badge>
                {outcomeLabels.map(o => (
                  <Badge key={o} variant="outline" className="text-xs">{o}</Badge>
                ))}
              </div>
              <SheetTitle className="text-xl">{project.title}</SheetTitle>
            </div>
            <div className="flex items-center gap-1">
              {isCreator && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0 -mt-1 text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent aria-describedby="delete-project-description">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Project</AlertDialogTitle>
                      <AlertDialogDescription id="delete-project-description">
                        Are you sure you want to delete "{project.title}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={async () => { try { await deleteProject(project.id); } catch {} finally { onClose(); } }} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0 -mt-1 -mr-2 gap-1" aria-label="Close project details">
                <ArrowLeft className="h-4 w-4" /> Back
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

          {/* Progress (owner editable) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Progress</span>
              <span className="text-sm text-primary font-bold">{project.progress_percent}%</span>
            </div>
            {isCreator ? (
              <Slider
                value={[project.progress_percent]}
                onValueChange={(v) => updateProjectProgress({ projectId: project.id, progress: v[0] })}
                max={100}
                step={5}
              />
            ) : (
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${project.progress_percent}%` }} />
              </div>
            )}
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
              <h4 className="font-medium flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Budget</h4>
              <span className="text-xl font-bold text-primary">{formatCurrency(project.total_budget)}</span>
            </div>
            {project.budget_range && <p className="text-sm text-muted-foreground">Range: {project.budget_range}</p>}
            <div className="space-y-2">
              {project.roles?.map((role, index) => {
                const percentage = (role.payout_amount * role.slots_available / Math.max(project.total_budget, 1)) * 100;
                const colors = ['bg-primary', 'bg-blue-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500'];
                return (
                  <div key={role.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-foreground">{role.role_name}</span>
                      <span className="text-muted-foreground">{formatCurrency(role.payout_amount)} × {role.slots_available}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", colors[index % colors.length])} style={{ width: `${percentage}%` }} />
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

          {/* Budget & Resources */}
          {(project.equipment_needed || project.venue || project.props_needed || project.sponsorship_needed || project.vendors_needed) && (
            <div className="bg-muted/30 rounded-xl p-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2"><Wrench className="h-4 w-4" /> Resources</h4>
              {project.equipment_needed && (
                <div className="text-sm"><span className="text-muted-foreground">Equipment:</span> {project.equipment_needed}</div>
              )}
              {project.venue && (
                <div className="text-sm flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {project.venue} {project.location_secured && <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400">Secured</Badge>}</div>
              )}
              {project.props_needed && (
                <div className="text-sm"><span className="text-muted-foreground">Props:</span> {project.props_needed}</div>
              )}
              <div className="flex gap-2 flex-wrap">
                {project.sponsorship_needed && <Badge variant="outline">Sponsorship Needed</Badge>}
                {project.vendors_needed && <Badge variant="outline">Vendors Needed</Badge>}
              </div>
            </div>
          )}

          {/* Timeline */}
          {(project.timeline_start || project.timeline_end) && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /><span>Timeline</span></div>
              <span>
                {project.timeline_start && format(new Date(project.timeline_start), 'MMM d, yyyy')}
                {project.timeline_start && project.timeline_end && ' → '}
                {project.timeline_end && format(new Date(project.timeline_end), 'MMM d, yyyy')}
              </span>
            </div>
          )}

          {/* Milestones Timeline */}
          {milestones.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Milestones</h4>
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-border" />
                {milestones.map((ms: any) => (
                  <div key={ms.id} className="relative">
                    <div className={cn(
                      "absolute -left-4 top-1 w-3 h-3 rounded-full border-2",
                      ms.status === 'approved' || ms.status === 'paid' ? "bg-emerald-500 border-emerald-500" :
                      ms.status === 'in_progress' || ms.status === 'submitted' ? "bg-amber-500 border-amber-500" :
                      "bg-background border-muted-foreground"
                    )} />
                    <div>
                      <p className="text-sm font-medium">{ms.title}</p>
                      <div className="flex items-center gap-2">
                        {ms.phase && <Badge variant="outline" className="text-[10px]">{ms.phase.replace('_', '-')}</Badge>}
                        {ms.due_date && <span className="text-xs text-muted-foreground">{format(new Date(ms.due_date), 'MMM d')}</span>}
                        <Badge className={cn('text-[10px]', ms.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground')}>{ms.status}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables */}
          {deliverables.length > 0 && deliverables.some(d => d.type) && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2"><Package className="h-4 w-4" /> Deliverables</h4>
              <div className="space-y-2">
                {deliverables.filter(d => d.type).map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-muted/20 rounded-lg p-3 text-sm">
                    <span className="font-medium">{d.type}</span>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      {d.publish_date && <span>{format(new Date(d.publish_date), 'MMM d')}</span>}
                      {d.publish_location && <span>• {d.publish_location}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs: Roles, Mood Board, Applications, Updates */}
          <Tabs defaultValue="roles" className="w-full">
            <TabsList className="w-full flex-wrap h-auto">
              <TabsTrigger value="roles" className="flex-1">Roles ({project.roles?.length || 0})</TabsTrigger>
              <TabsTrigger value="moodboard" className="flex-1">Files ({attachments.length})</TabsTrigger>
              {isCreator && (
                <TabsTrigger value="applications" className="flex-1">Apps ({applications.filter(a => a.status === 'pending').length})</TabsTrigger>
              )}
              <TabsTrigger value="updates" className="flex-1">Updates</TabsTrigger>
            </TabsList>

            {/* Roles Tab */}
            <TabsContent value="roles" className="mt-4 space-y-3">
              {project.roles?.map((role) => {
                const hasApplied = hasAppliedToRole(role.id);
                const isSelected = selectedRole?.id === role.id;
                return (
                  <div
                    key={role.id}
                    className={cn(
                      "border rounded-lg p-4 transition-all",
                      role.is_locked ? "bg-muted/20 border-muted opacity-60" :
                      isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 cursor-pointer"
                    )}
                    onClick={() => !role.is_locked && !isCreator && !hasApplied && setSelectedRole(isSelected ? null : role)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h5 className="font-medium">{role.role_name}</h5>
                        {role.description && <p className="text-sm text-muted-foreground">{role.description}</p>}
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-primary">{formatCurrency(role.payout_amount)}</span>
                        <p className="text-xs text-muted-foreground">per person</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" /><span>{role.slots_filled}/{role.slots_available} filled</span></div>
                      {role.is_locked ? <Badge variant="secondary">Filled</Badge> :
                       hasApplied ? <Badge className="bg-amber-500/20 text-amber-400">Applied</Badge> :
                       !isCreator && <Badge className={isSelected ? "bg-primary" : "bg-primary/20 text-primary"}>{isSelected ? 'Selected' : 'Click to Apply'}</Badge>}
                    </div>
                  </div>
                );
              })}

              {/* Custom role + application form */}
              {selectedRole && !isCreator && (
                <div className="border border-primary rounded-lg p-4 space-y-3 animate-fade-in">
                  <h5 className="font-medium">Apply for {selectedRole.role_name}</h5>
                  <Textarea value={applicationMessage} onChange={(e) => setApplicationMessage(e.target.value)} placeholder="Introduce yourself and why you're a great fit..." rows={3} />
                  <div className="flex gap-2">
                    <Button onClick={handleApply} disabled={isApplying} className="flex-1 min-h-[44px]">
                      <Send className="h-4 w-4 mr-2" />{isApplying ? 'Sending...' : 'Submit Application'}
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedRole(null)} className="min-h-[44px]">Cancel</Button>
                  </div>
                </div>
              )}

              {/* Custom role proposal */}
              {project.allow_custom_roles && !isCreator && (
                <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
                  <h5 className="text-sm font-medium">Propose Your Own Role</h5>
                  <p className="text-xs text-muted-foreground">The project creator allows custom role proposals</p>
                  <Input value={customRoleName} onChange={(e) => setCustomRoleName(e.target.value)} placeholder="What role would you like to fill?" />
                  <Textarea value={applicationMessage} onChange={(e) => setApplicationMessage(e.target.value)} placeholder="How would you contribute?" rows={2} />
                </div>
              )}
            </TabsContent>

            {/* Mood Board Tab */}
            <TabsContent value="moodboard" className="mt-4">
              {attachments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No files uploaded yet</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {attachments.map((att) => (
                    <div key={att.id} className="border border-border rounded-lg overflow-hidden group">
                      {att.file_type === 'image' ? (
                        <img src={att.file_url} alt={att.file_name} className="w-full h-28 object-cover" />
                      ) : (
                        <div className="w-full h-28 bg-muted/30 flex items-center justify-center">
                          {fileTypeIcon(att.file_type)}
                        </div>
                      )}
                      <div className="p-2 flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <Badge className={cn('text-[10px] mb-1', att.file_type === 'image' ? 'bg-blue-500/20 text-blue-400' : att.file_type === 'pdf' ? 'bg-red-500/20 text-red-400' : att.file_type === 'video' ? 'bg-purple-500/20 text-purple-400' : 'bg-muted text-muted-foreground')}>{att.file_type.toUpperCase()}</Badge>
                          <p className="text-xs text-muted-foreground truncate">{att.file_name}</p>
                        </div>
                        <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 hover:bg-muted rounded">
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Applications Tab */}
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
                            <p className="text-xs text-muted-foreground">Applied for {app.role?.role_name} • {format(new Date(app.created_at), 'MMM d')}</p>
                          </div>
                        </div>
                        <Badge className={cn(
                          app.status === 'pending' && 'bg-amber-500/20 text-amber-400',
                          app.status === 'accepted' && 'bg-emerald-500/20 text-emerald-400',
                          app.status === 'rejected' && 'bg-red-500/20 text-red-400'
                        )}>{app.status}</Badge>
                      </div>
                      {app.message && <p className="text-sm text-muted-foreground mb-3 bg-muted/30 rounded p-2">"{app.message}"</p>}
                      {app.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => reviewApplication({ applicationId: app.id, status: 'accepted' })} className="flex-1 min-h-[44px]"><Check className="h-4 w-4 mr-1" /> Accept</Button>
                          <Button size="sm" variant="outline" onClick={() => reviewApplication({ applicationId: app.id, status: 'rejected' })} className="flex-1 min-h-[44px]"><XIcon className="h-4 w-4 mr-1" /> Reject</Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
            )}

            {/* Updates Tab */}
            <TabsContent value="updates" className="mt-4 space-y-4">
              {isCreator && (
                <div className="space-y-2">
                  <Textarea value={updateContent} onChange={(e) => setUpdateContent(e.target.value)} placeholder="Post a project update..." rows={2} />
                  <Button size="sm" onClick={handlePostUpdate} disabled={isPosting || !updateContent.trim()}>
                    <MessageSquare className="h-4 w-4 mr-1" /> {isPosting ? 'Posting...' : 'Post Update'}
                  </Button>
                </div>
              )}
              {updates.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No updates yet</p>
              ) : (
                updates.map((update) => (
                  <div key={update.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={update.author?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">{update.author?.display_name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{update.author?.display_name || 'Anonymous'}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(update.created_at), 'MMM d, h:mm a')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{update.content}</p>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};
