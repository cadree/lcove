import React, { useState, useRef, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, DollarSign, Calendar, Users, Check, XIcon, Clock, Send, Trash2, Download, FileText, Film, Package, Link, MapPin, Wrench, Target, BarChart3, MessageSquare, Play, ExternalLink, Upload, X, Eye, Image as ImageIcon, Camera, Share2, Copy, Pencil, Mail, MessageCircle } from 'lucide-react';
import { Project, ProjectRole, useProjectApplications, useProjects } from '@/hooks/useProjects';
import { useProjectAttachments, ProjectAttachment } from '@/hooks/useProjectAttachments';
import { useProjectUpdates } from '@/hooks/useProjectUpdates';
import { useProjectMilestones } from '@/hooks/useProjectMilestones';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { EditProjectDialog } from '@/components/projects/EditProjectDialog';

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

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function isExternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return !u.hostname.includes('supabase');
  } catch {
    return false;
  }
}

function getDomainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'link';
  }
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, open, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<ProjectRole | null>(null);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [customRoleName, setCustomRoleName] = useState('');
  const [updateContent, setUpdateContent] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { applications, applyToProject, reviewApplication, isApplying } = useProjectApplications(project?.id);
  const { deleteProject, isDeleting, updateProjectProgress, updateProjectCoverImage } = useProjects();
  const { attachments, uploadAttachment, addLinkAttachment, deleteAttachment, isUploading } = useProjectAttachments(project?.id);
  const { updates, addUpdate, isPosting } = useProjectUpdates(project?.id);
  const { data: milestones = [] } = useProjectMilestones(project?.id);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, []);

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

  const handleCustomRoleSubmit = () => {
    if (!customRoleName.trim()) return;
    // Apply with first available role and include custom role name in message
    const placeholderRole = project.roles?.[0];
    if (!placeholderRole) {
      toast({ title: 'No roles defined for this project', variant: 'destructive' });
      return;
    }
    const msg = `[Custom Role Proposal: ${customRoleName}]\n${applicationMessage}`;
    applyToProject({ projectId: project.id, roleId: placeholderRole.id, message: msg }, {
      onSuccess: () => { setCustomRoleName(''); setApplicationMessage(''); toast({ title: 'Role proposal submitted!' }); }
    });
  };

  const hasAppliedToRole = (roleId: string) => applications.some(a => a.role_id === roleId && a.applicant_id === user?.id);

  const handlePostUpdate = () => {
    if (!updateContent.trim() || !project.id) return;
    addUpdate({ projectId: project.id, content: updateContent });
    setUpdateContent('');
  };

  const handleProgressChange = (v: number[]) => {
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    progressTimerRef.current = setTimeout(() => {
      updateProjectProgress({ projectId: project.id, progress: v[0] });
    }, 500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !project.id) return;
    Array.from(files).forEach(file => {
      uploadAttachment({ projectId: project.id, file });
    });
    e.target.value = '';
  };

  const handleAddLink = () => {
    if (!linkUrl.trim() || !project.id) return;
    addLinkAttachment({ projectId: project.id, url: linkUrl, name: linkName || getDomainLabel(linkUrl) });
    setLinkUrl('');
    setLinkName('');
  };

  const handleDownload = async (att: ProjectAttachment) => {
    if (att.file_type === 'link' || isExternalUrl(att.file_url)) {
      window.open(att.file_url, '_blank', 'noopener');
      return;
    }
    // For storage files, fetch and trigger download
    try {
      const response = await fetch(att.file_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(att.file_url, '_blank', 'noopener');
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project.id || !user?.id) return;
    setIsUploadingCover(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user.id}/project-covers/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
      updateProjectCoverImage({ projectId: project.id, coverImageUrl: publicUrl });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploadingCover(false);
      e.target.value = '';
    }
  };

  const outcomeLabels = project.expected_outcome?.split(', ').filter(Boolean) || [];
  const deliverables = (project.deliverables as any[]) || [];

  const renderAttachmentPreview = (att: ProjectAttachment) => {
    const ytId = (att.file_type === 'video' || att.file_type === 'link') ? getYouTubeId(att.file_url) : null;

    if (ytId) {
      return (
        <div className="w-full aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}`}
            title={att.file_name}
            className="w-full h-full rounded-t-lg"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    if (att.file_type === 'image') {
      return (
        <div className="relative cursor-pointer" onClick={() => setLightboxUrl(att.file_url)}>
          <img src={att.file_url} alt={att.file_name} className="w-full h-32 object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      );
    }

    if (att.file_type === 'video') {
      return (
        <div className="w-full h-32 bg-muted/40 flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Play className="h-5 w-5 text-purple-400" />
          </div>
          <span className="text-[10px] text-muted-foreground">Video</span>
        </div>
      );
    }

    if (att.file_type === 'pdf' || att.file_type === 'doc') {
      const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(att.file_url)}&embedded=true`;
      const badgeColor = att.file_type === 'pdf' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400';
      const bgColor = att.file_type === 'pdf' ? 'bg-red-500/5' : 'bg-amber-500/5';
      return (
        <div
          className={cn("w-full h-40 relative cursor-pointer overflow-hidden", bgColor)}
          onClick={() => window.open(att.file_url, '_blank', 'noopener')}
        >
          <iframe
            src={viewerUrl}
            title={att.file_name}
            className="w-full h-full pointer-events-none border-0 scale-100"
            loading="lazy"
          />
          {/* Overlay to prevent interaction & show click-to-open */}
          <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 transition-colors" />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background to-transparent p-2 flex items-end justify-between">
            <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[70%]">{att.file_name}</span>
            <Badge className={cn("text-[9px]", badgeColor)}>{att.file_type.toUpperCase()}</Badge>
          </div>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Badge className="text-[9px] bg-background/80 text-foreground">Click to open</Badge>
          </div>
        </div>
      );
    }

    if (att.file_type === 'link') {
      return (
        <div className="w-full h-32 bg-cyan-500/5 flex flex-col items-center justify-center gap-2">
          <ExternalLink className="h-8 w-8 text-cyan-400" />
          <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[90%] px-2">{getDomainLabel(att.file_url)}</span>
        </div>
      );
    }

    if (att.file_type === 'zip') {
      return (
        <div className="w-full h-32 bg-emerald-500/5 flex flex-col items-center justify-center gap-2">
          <Package className="h-8 w-8 text-emerald-400" />
          <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[90%] px-2">{att.file_name}</span>
          <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400">ZIP</Badge>
        </div>
      );
    }

    return (
      <div className="w-full h-32 bg-muted/30 flex flex-col items-center justify-center gap-2">
        <FileText className="h-8 w-8 text-amber-400" />
        <span className="text-[10px] text-muted-foreground truncate max-w-[90%] px-2">{att.file_name}</span>
      </div>
    );
  };

  return (
    <>
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
              <div className="flex items-center gap-1 relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 -mt-1"
                  onClick={() => setShareMenuOpen(prev => !prev)}
                  aria-label="Share project"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                {shareMenuOpen && project && (
                  <div className="absolute right-0 top-9 z-50 w-56 rounded-lg border border-border bg-popover p-1.5 shadow-lg animate-in fade-in-0 zoom-in-95">
                    {(() => {
                      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
                      const url = `${supabaseUrl}/functions/v1/share-page/p/${project.id}`;
                      const text = `Check out this project: ${project.title}`;
                      return (
                        <>
                          <button
                            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(url);
                                toast({ title: 'Link copied to clipboard!' });
                              } catch {
                                window.prompt('Copy this link:', url);
                              }
                              setShareMenuOpen(false);
                            }}
                          >
                            <Copy className="h-4 w-4 text-muted-foreground" />
                            Copy Link
                          </button>
                          <button
                            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                            onClick={() => {
                              window.open(`mailto:?subject=${encodeURIComponent(project.title)}&body=${encodeURIComponent(text + '\n' + url)}`, '_blank');
                              setShareMenuOpen(false);
                            }}
                          >
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            Email
                          </button>
                          <button
                            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                            onClick={() => {
                              window.open(`sms:?body=${encodeURIComponent(text + ' ' + url)}`, '_blank');
                              setShareMenuOpen(false);
                            }}
                          >
                            <MessageCircle className="h-4 w-4 text-muted-foreground" />
                            Text Message
                          </button>
                          {typeof navigator.share === 'function' && (
                            <button
                              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                              onClick={async () => {
                                try {
                                  await navigator.share({ title: project.title, text, url });
                                } catch {}
                                setShareMenuOpen(false);
                              }}
                            >
                              <Share2 className="h-4 w-4 text-muted-foreground" />
                              More Options…
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
                {isCreator && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 -mt-1"
                    onClick={() => setEditDialogOpen(true)}
                    aria-label="Edit project"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
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
            {/* Cover image */}
            <div className="rounded-xl overflow-hidden -mt-2 relative group">
              {project.cover_image_url ? (
                <img src={project.cover_image_url} alt={project.title} className="w-full h-40 object-cover" />
              ) : isCreator ? (
                <div className="w-full h-32 bg-muted/30 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2">
                  <Camera className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Add a cover image</span>
                </div>
              ) : null}
              {isCreator && (
                <>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverImageUpload}
                  />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={isUploadingCover}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors cursor-pointer"
                  >
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium flex items-center gap-1.5">
                      <Camera className="h-4 w-4" />
                      {isUploadingCover ? 'Uploading...' : project.cover_image_url ? 'Change Cover' : 'Add Cover'}
                    </span>
                  </button>
                </>
              )}
            </div>

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

            {/* Progress (owner editable with debounce) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Progress</span>
                <span className="text-sm text-primary font-bold">{project.progress_percent}%</span>
              </div>
              {isCreator ? (
                <Slider
                  defaultValue={[project.progress_percent]}
                  onValueChange={handleProgressChange}
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

                {/* Application form */}
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

                {/* Custom role proposal with submit */}
                {project.allow_custom_roles && !isCreator && (
                  <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
                    <h5 className="text-sm font-medium">Propose Your Own Role</h5>
                    <p className="text-xs text-muted-foreground">The project creator allows custom role proposals</p>
                    <Input value={customRoleName} onChange={(e) => setCustomRoleName(e.target.value)} placeholder="What role would you like to fill?" />
                    <Textarea value={applicationMessage} onChange={(e) => setApplicationMessage(e.target.value)} placeholder="How would you contribute?" rows={2} />
                    <Button size="sm" onClick={handleCustomRoleSubmit} disabled={isApplying || !customRoleName.trim()} className="w-full min-h-[44px]">
                      <Send className="h-4 w-4 mr-2" />{isApplying ? 'Submitting...' : 'Submit Proposal'}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Mood Board Tab */}
              <TabsContent value="moodboard" className="mt-4 space-y-4">
                {/* Upload controls for creator */}
                {isCreator && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*,.pdf,.zip,.doc,.docx"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex-1">
                        <Upload className="h-4 w-4 mr-2" />{isUploading ? 'Uploading...' : 'Upload Files'}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Paste a link (YouTube, Figma, etc.)" className="flex-1" />
                      <Button variant="outline" size="sm" onClick={handleAddLink} disabled={!linkUrl.trim()}>
                        <Link className="h-4 w-4 mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                )}

                {attachments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No files uploaded yet</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {attachments.map((att) => (
                      <div key={att.id} className="border border-border rounded-lg overflow-hidden group relative">
                        {renderAttachmentPreview(att)}
                        <div className="p-2 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <Badge className={cn('text-[10px] mb-1',
                              att.file_type === 'image' ? 'bg-blue-500/20 text-blue-400' :
                              att.file_type === 'pdf' ? 'bg-red-500/20 text-red-400' :
                              att.file_type === 'video' ? 'bg-purple-500/20 text-purple-400' :
                              att.file_type === 'link' ? 'bg-cyan-500/20 text-cyan-400' :
                              'bg-muted text-muted-foreground'
                            )}>{att.file_type.toUpperCase()}</Badge>
                            <p className="text-xs text-muted-foreground truncate">{att.file_name}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleDownload(att)}
                              className="p-1 hover:bg-muted rounded"
                              title="Download"
                            >
                              <Download className="h-4 w-4 text-muted-foreground" />
                            </button>
                            {isCreator && (
                              <button
                                onClick={() => deleteAttachment({ attachmentId: att.id, projectId: project.id })}
                                className="p-1 hover:bg-destructive/10 rounded"
                                title="Remove"
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </button>
                            )}
                          </div>
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
                              <p className="text-xs text-muted-foreground">
                                {app.message?.startsWith('[Custom Role Proposal:') ? 'Proposed custom role' : `Applied for ${app.role?.role_name}`} • {format(new Date(app.created_at), 'MMM d')}
                              </p>
                            </div>
                          </div>
                          <Badge className={cn(
                            app.status === 'pending' && 'bg-amber-500/20 text-amber-400',
                            app.status === 'accepted' && 'bg-emerald-500/20 text-emerald-400',
                            app.status === 'rejected' && 'bg-red-500/20 text-red-400'
                          )}>{app.status}</Badge>
                        </div>
                        {app.message && (() => {
                          const customMatch = app.message.match(/^\[Custom Role Proposal:\s*(.+?)\]\s*(.*)/s);
                          if (customMatch) {
                            return (
                              <div className="mb-3 space-y-2">
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                  Proposed Role: {customMatch[1].trim()}
                                </Badge>
                                {customMatch[2]?.trim() && (
                                  <p className="text-sm text-muted-foreground bg-muted/30 rounded p-2">"{customMatch[2].trim()}"</p>
                                )}
                              </div>
                            );
                          }
                          return <p className="text-sm text-muted-foreground mb-3 bg-muted/30 rounded p-2">"{app.message}"</p>;
                        })()}
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

      {/* Image Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black/90 border-none">
          {lightboxUrl && (
            <img src={lightboxUrl} alt="Preview" className="w-full h-auto max-h-[80vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <EditProjectDialog
        project={project}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  );
};
