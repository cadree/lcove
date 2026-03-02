import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import {
  ChevronDown, ChevronUp, MapPin, Wrench, Package, DollarSign,
  Target, Calendar, Users, Image as ImageIcon, FileText, Play,
  ExternalLink, Clock, CheckCircle2, Circle, AlertCircle, Sparkles,
  Edit2, Plus, ClipboardList
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectChatData } from '@/hooks/useProjectChatData';
import { useCreateMilestone, useUpdateMilestoneStatus } from '@/hooks/useProjectMilestones';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ProjectChecklist from './ProjectChecklist';

interface ProjectCommandCenterProps {
  project: ProjectChatData;
  isOwner: boolean;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function getNextMilestone(milestones: ProjectChatData['milestones']) {
  const upcoming = milestones
    .filter(m => m.due_date && m.status !== 'paid' && m.status !== 'approved')
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  return upcoming[0] || null;
}

const MilestoneStatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'approved':
    case 'paid':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'submitted':
    case 'in_progress':
      return <Clock className="w-3.5 h-3.5 text-amber-400" />;
    default:
      return <Circle className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

const ProjectCommandCenter = ({ project, isOwner }: ProjectCommandCenterProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllAttachments, setShowAllAttachments] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState(false);
  const [timelineStart, setTimelineStart] = useState(project.timeline_start || '');
  const [timelineEnd, setTimelineEnd] = useState(project.timeline_end || '');
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDue, setNewMilestoneDue] = useState('');

  const queryClient = useQueryClient();
  const createMilestone = useCreateMilestone();
  const updateMilestoneStatus = useUpdateMilestoneStatus();

  const nextMilestone = getNextMilestone(project.milestones);
  const filledRoles = project.roles.reduce((s, r) => s + r.slots_filled, 0);
  const totalSlots = project.roles.reduce((s, r) => s + r.slots_available, 0);
  const visibleAttachments = showAllAttachments ? project.attachments : project.attachments.slice(0, 6);

  const countdownText = (() => {
    const target = nextMilestone?.due_date || project.timeline_start;
    if (!target) return null;
    const d = new Date(target);
    if (isPast(d)) return 'Overdue';
    return formatDistanceToNow(d, { addSuffix: false }) + ' left';
  })();

  // Timeline update mutation
  const updateTimeline = useMutation({
    mutationFn: async ({ start, end }: { start: string; end: string }) => {
      const { error } = await supabase.from('projects')
        .update({ timeline_start: start || null, timeline_end: end || null })
        .eq('id', project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-chat-data', project.id] });
      setEditingTimeline(false);
      toast.success('Timeline updated');
    },
    onError: () => toast.error('Failed to update timeline'),
  });

  const handleAddMilestone = () => {
    if (!newMilestoneTitle.trim()) return;
    createMilestone.mutate({
      project_id: project.id,
      title: newMilestoneTitle.trim(),
      amount: 0,
      due_date: newMilestoneDue || undefined,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['project-chat-data', project.id] });
        setNewMilestoneTitle('');
        setNewMilestoneDue('');
        setAddingMilestone(false);
      },
    });
  };

  const cycleMilestoneStatus = (ms: ProjectChatData['milestones'][0]) => {
    if (!isOwner) return;
    const order = ['pending', 'in_progress', 'submitted', 'approved', 'paid'];
    const idx = order.indexOf(ms.status);
    const next = order[Math.min(idx + 1, order.length - 1)];
    if (next === ms.status) return;
    updateMilestoneStatus.mutate({
      milestoneId: ms.id,
      status: next as any,
      projectId: project.id,
    }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-chat-data', project.id] }),
    });
  };

  return (
    <div className="border-b border-border/50 bg-card/30">
      {/* Cover Image */}
      {project.cover_image_url && (
        <div className="relative h-32 w-full overflow-hidden">
          <img src={project.cover_image_url} alt={project.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card/80" />
        </div>
      )}

      {/* Header Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold text-sm text-foreground truncate">Project Command Center</span>
          {countdownText && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              <Clock className="w-3 h-3 mr-1" />{countdownText}
            </Badge>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Vision */}
              {project.description && (
                <Section icon={<Target className="w-4 h-4 text-primary" />} title="Vision">
                  <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
                </Section>
              )}

              {/* Progress */}
              <div className="flex items-center gap-3">
                <Progress value={project.progress_percent} className="flex-1 h-2" />
                <span className="text-xs text-muted-foreground font-medium">{project.progress_percent}%</span>
              </div>

              {/* Moodboard */}
              {project.attachments.length > 0 && (
                <Section icon={<ImageIcon className="w-4 h-4 text-primary" />} title={`Moodboard (${project.attachments.length})`}>
                  <div className="grid grid-cols-3 gap-2">
                    {visibleAttachments.map(att => (
                      <AttachmentThumbnail key={att.id} attachment={att} />
                    ))}
                  </div>
                  {project.attachments.length > 6 && !showAllAttachments && (
                    <Button variant="ghost" size="sm" className="mt-2 w-full text-xs text-muted-foreground"
                      onClick={(e) => { e.stopPropagation(); setShowAllAttachments(true); }}>
                      View all {project.attachments.length} items
                    </Button>
                  )}
                </Section>
              )}

              {/* Checklist System */}
              <Section icon={<ClipboardList className="w-4 h-4 text-primary" />} title="Checklist">
                <ProjectChecklist projectId={project.id} isOwner={isOwner} />
              </Section>

              {/* Location */}
              {project.venue && <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Venue" value={project.venue} />}
              {project.equipment_needed && <InfoRow icon={<Wrench className="w-3.5 h-3.5" />} label="Equipment" value={project.equipment_needed} />}
              {project.props_needed && <InfoRow icon={<Package className="w-3.5 h-3.5" />} label="Props Needed" value={project.props_needed} />}

              {/* Sponsorship badges */}
              <div className="flex flex-wrap gap-2">
                {project.sponsorship_needed && (
                  <Badge variant="secondary" className="text-xs"><AlertCircle className="w-3 h-3 mr-1" /> Sponsorship Needed</Badge>
                )}
                {project.vendors_needed && (
                  <Badge variant="secondary" className="text-xs"><Package className="w-3 h-3 mr-1" /> Vendors Needed</Badge>
                )}
              </div>

              {/* Timeline */}
              {(project.timeline_start || project.timeline_end || isOwner) && (
                <Section icon={<Calendar className="w-4 h-4 text-primary" />} title="Timeline"
                  action={isOwner ? (
                    <Button variant="ghost" size="icon" className="w-5 h-5" onClick={() => setEditingTimeline(!editingTimeline)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  ) : undefined}
                >
                  {editingTimeline ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input type="date" value={timelineStart} onChange={e => setTimelineStart(e.target.value)} className="h-8 text-xs" />
                        <Input type="date" value={timelineEnd} onChange={e => setTimelineEnd(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <Button size="sm" className="text-xs" onClick={() => updateTimeline.mutate({ start: timelineStart, end: timelineEnd })}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {project.timeline_start ? format(new Date(project.timeline_start), 'MMM d') : '?'} → {project.timeline_end ? format(new Date(project.timeline_end), 'MMM d, yyyy') : '?'}
                    </p>
                  )}
                </Section>
              )}

              {/* Milestones */}
              {(project.milestones.length > 0 || isOwner) && (
                <Section icon={<Target className="w-4 h-4 text-primary" />} title="Milestones"
                  action={isOwner ? (
                    <Button variant="ghost" size="icon" className="w-5 h-5" onClick={() => setAddingMilestone(!addingMilestone)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  ) : undefined}
                >
                  <div className="space-y-2">
                    {project.milestones.map(ms => (
                      <div key={ms.id} className={`flex items-center gap-2 ${isOwner ? 'cursor-pointer hover:bg-muted/20 rounded px-1 -mx-1' : ''}`}
                        onClick={() => cycleMilestoneStatus(ms)}>
                        <MilestoneStatusIcon status={ms.status} />
                        <span className="text-sm flex-1 truncate">{ms.title}</span>
                        {ms.due_date && (
                          <span className="text-[10px] text-muted-foreground">{format(new Date(ms.due_date), 'MMM d')}</span>
                        )}
                      </div>
                    ))}
                    {addingMilestone && (
                      <div className="space-y-2 p-2 rounded bg-muted/20">
                        <Input placeholder="Milestone title" value={newMilestoneTitle} onChange={e => setNewMilestoneTitle(e.target.value)} className="h-8 text-xs" />
                        <Input type="date" value={newMilestoneDue} onChange={e => setNewMilestoneDue(e.target.value)} className="h-8 text-xs" />
                        <Button size="sm" className="text-xs" onClick={handleAddMilestone}>Add</Button>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Deliverables */}
              {project.deliverables && project.deliverables.length > 0 && (
                <Section icon={<CheckCircle2 className="w-4 h-4 text-primary" />} title="Deliverables">
                  <ul className="space-y-1">
                    {project.deliverables.map((d: any, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {typeof d === 'string' ? d : d.title || d.name || JSON.stringify(d)}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Budget */}
              {(project.total_budget > 0 || project.budget_range) && (
                <InfoRow icon={<DollarSign className="w-3.5 h-3.5" />} label="Budget"
                  value={project.budget_range || `${project.currency} ${project.total_budget.toLocaleString()}`} />
              )}

              {/* Roles */}
              {project.roles.length > 0 && (
                <Section icon={<Users className="w-4 h-4 text-primary" />} title={`Roles (${filledRoles}/${totalSlots} filled)`}>
                  <div className="space-y-1.5">
                    {project.roles.map(role => (
                      <div key={role.id} className="flex items-center justify-between">
                        <span className="text-sm truncate">{role.role_name}</span>
                        <Badge variant={role.slots_filled >= role.slots_available ? 'default' : 'outline'} className="text-[10px]">
                          {role.slots_filled}/{role.slots_available}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Sub-components ───────────────────────── */

const Section = ({ icon, title, children, action }: { icon: React.ReactNode; title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex-1">{title}</h4>
      {action}
    </div>
    {children}
  </div>
);

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-2 text-sm">
    <span className="text-muted-foreground mt-0.5">{icon}</span>
    <span className="text-muted-foreground">{label}:</span>
    <span className="text-foreground">{value}</span>
  </div>
);

const AttachmentThumbnail = ({ attachment }: { attachment: ProjectChatData['attachments'][0] }) => {
  const [showEmbed, setShowEmbed] = useState(false);
  const ytId = getYouTubeId(attachment.file_url);

  if (ytId) {
    return (
      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
        {showEmbed ? (
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
            className="w-full h-full"
            allowFullScreen
            allow="autoplay; encrypted-media"
            title={attachment.file_name}
          />
        ) : (
          <button onClick={() => setShowEmbed(true)} className="block w-full h-full group">
            <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt={attachment.file_name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
              <Play className="w-8 h-8 text-white" />
            </div>
          </button>
        )}
      </div>
    );
  }

  if (attachment.file_type === 'pdf' || attachment.file_type === 'doc') {
    const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(attachment.file_url)}`;
    return (
      <div className="relative aspect-square rounded-lg overflow-hidden bg-muted/50 border border-border/50 group cursor-pointer"
        onClick={() => window.open(viewerUrl, '_blank', 'noopener,noreferrer')}>
        <div className="flex flex-col items-center justify-center h-full p-2">
          <FileText className="w-8 h-8 text-primary mb-1" />
          <span className="text-[10px] text-muted-foreground text-center truncate w-full">{attachment.file_name}</span>
          <span className="mt-1 text-[10px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View / Download
          </span>
        </div>
      </div>
    );
  }

  if (attachment.file_type === 'image') {
    return (
      <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-muted">
        <img src={attachment.file_url} alt={attachment.file_name} className="w-full h-full object-cover hover:scale-105 transition-transform" />
      </a>
    );
  }

  if (attachment.file_type === 'video') {
    return (
      <div className="aspect-video rounded-lg overflow-hidden bg-muted">
        <video src={attachment.file_url} controls className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <a href={attachment.file_url} target="_blank" rel="noopener noreferrer"
      className="flex flex-col items-center justify-center aspect-square rounded-lg bg-muted/50 border border-border/50 hover:bg-muted transition-colors p-2">
      <ExternalLink className="w-5 h-5 text-muted-foreground mb-1" />
      <span className="text-[10px] text-muted-foreground text-center truncate w-full">{attachment.file_name}</span>
    </a>
  );
};

export default ProjectCommandCenter;
