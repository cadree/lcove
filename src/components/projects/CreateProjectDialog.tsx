import React, { useState, useCallback } from 'react';
import { Plus, Trash2, DollarSign, Coins, Upload, X, Image, Link, FileText, Film, Package, Calendar, MapPin, Wrench, Users2, Target, Milestone, Lock, FolderKanban } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ProjectType = 'paid' | 'volunteer' | 'hybrid';

interface RoleInput {
  role_name: string;
  description: string;
  payout_amount: number;
  slots_available: number;
}

interface MilestoneInput {
  title: string;
  phase: string;
  due_date: string;
}

interface AttachmentInput {
  file?: File;
  url?: string;
  name: string;
  type: string;
  preview?: string;
}

interface DeliverableInput {
  type: string;
  publish_date: string;
  publish_location: string;
}

const EXPECTED_OUTCOMES = ['Portfolio piece', 'Paid production', 'Experimental', 'Community collab'];
const DELIVERABLE_TYPES = ['Photos', 'Film', 'Edited reels', 'Final garment', 'Event', 'Music', 'Other'];
const BUDGET_RANGES = ['$0 (Volunteer)', '$1 - $500', '$500 - $2,000', '$2,000 - $5,000', '$5,000 - $10,000', '$10,000+'];
const DEFAULT_PHASES = [
  { title: 'Pre-production', phase: 'pre_production' },
  { title: 'Production', phase: 'production' },
  { title: 'Post-production', phase: 'post_production' },
  { title: 'Final Delivery', phase: 'final_delivery' },
];

interface CreateProjectDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({ 
  children, 
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange 
}) => {
  const { createProject, isCreating } = useProjects();
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  // Basic
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('volunteer');
  const [totalBudget, setTotalBudget] = useState('');
  const [creditsReward, setCreditsReward] = useState(25);
  const [isPrivate, setIsPrivate] = useState(false);

  // Expected outcome
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);

  // Mood board
  const [attachments, setAttachments] = useState<AttachmentInput[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [isMoodboardPublic, setIsMoodboardPublic] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  // Budget & Resources
  const [budgetRange, setBudgetRange] = useState('');
  const [equipmentNeeded, setEquipmentNeeded] = useState('');
  const [locationSecured, setLocationSecured] = useState(false);
  const [venue, setVenue] = useState('');
  const [propsNeeded, setPropsNeeded] = useState('');
  const [sponsorshipNeeded, setSponsorshipNeeded] = useState(false);
  const [vendorsNeeded, setVendorsNeeded] = useState(false);

  // Timeline
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');

  // Milestones
  const [milestones, setMilestones] = useState<MilestoneInput[]>(
    DEFAULT_PHASES.map(p => ({ title: p.title, phase: p.phase, due_date: '' }))
  );

  // Roles
  const [roles, setRoles] = useState<RoleInput[]>([
    { role_name: '', description: '', payout_amount: 0, slots_available: 1 }
  ]);
  const [allowCustomRoles, setAllowCustomRoles] = useState(false);

  // Deliverables
  const [deliverables, setDeliverables] = useState<DeliverableInput[]>([
    { type: '', publish_date: '', publish_location: '' }
  ]);

  // Handlers
  const toggleOutcome = (outcome: string) => {
    setSelectedOutcomes(prev => 
      prev.includes(outcome) ? prev.filter(o => o !== outcome) : [...prev, outcome]
    );
  };

  const addRole = () => setRoles([...roles, { role_name: '', description: '', payout_amount: 0, slots_available: 1 }]);
  const removeRole = (i: number) => setRoles(roles.filter((_, idx) => idx !== i));
  const updateRole = (i: number, field: keyof RoleInput, value: string | number) => {
    const updated = [...roles];
    updated[i] = { ...updated[i], [field]: value };
    setRoles(updated);
  };

  const addMilestone = () => setMilestones([...milestones, { title: '', phase: 'custom', due_date: '' }]);
  const removeMilestone = (i: number) => setMilestones(milestones.filter((_, idx) => idx !== i));
  const updateMilestone = (i: number, field: keyof MilestoneInput, value: string) => {
    const updated = [...milestones];
    updated[i] = { ...updated[i], [field]: value };
    setMilestones(updated);
  };

  const addDeliverable = () => setDeliverables([...deliverables, { type: '', publish_date: '', publish_location: '' }]);
  const removeDeliverable = (i: number) => setDeliverables(deliverables.filter((_, idx) => idx !== i));
  const updateDeliverable = (i: number, field: keyof DeliverableInput, value: string) => {
    const updated = [...deliverables];
    updated[i] = { ...updated[i], [field]: value };
    setDeliverables(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: AttachmentInput[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let type = 'doc';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type === 'application/pdf') type = 'pdf';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.includes('zip')) type = 'zip';

      const preview = type === 'image' ? URL.createObjectURL(file) : undefined;
      newAttachments.push({ file, name: file.name, type, preview });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const addLink = () => {
    if (!linkUrl.trim()) return;
    let type = 'link';
    const url = linkUrl.trim();
    let name = url;
    if (url.includes('youtube.com') || url.includes('youtu.be')) { type = 'video'; name = 'YouTube Reference'; }
    else if (url.includes('figma.com')) { type = 'link'; name = 'Figma Design'; }
    else if (url.includes('drive.google.com')) { type = 'link'; name = 'Google Drive'; }
    
    setAttachments(prev => [...prev, { url, name, type }]);
    setLinkUrl('');
  };

  const removeAttachment = (i: number) => {
    const att = attachments[i];
    if (att.preview) URL.revokeObjectURL(att.preview);
    setAttachments(attachments.filter((_, idx) => idx !== i));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files.length) return;
    
    const newAttachments: AttachmentInput[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let type = 'doc';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type === 'application/pdf') type = 'pdf';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.includes('zip')) type = 'zip';
      const preview = type === 'image' ? URL.createObjectURL(file) : undefined;
      newAttachments.push({ file, name: file.name, type, preview });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
  }, []);

  const totalRolePayout = roles.reduce((sum, role) => sum + (role.payout_amount * role.slots_available), 0);
  const budgetNum = parseFloat(totalBudget) || 0;
  const remaining = budgetNum - totalRolePayout;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const validRoles = roles.filter(r => r.role_name.trim());
    const validMilestones = milestones.filter(m => m.title.trim());
    const validDeliverables = deliverables.filter(d => d.type.trim());

    const timelineStart = startDate ? `${startDate}${startTime ? `T${startTime}` : 'T00:00'}` : undefined;
    const timelineEnd = endDate ? `${endDate}${endTime ? `T${endTime}` : 'T23:59'}` : undefined;

    // Upload attachment files first
    let coverImageUrl: string | undefined;
    const uploadedAttachments: { file_url: string; file_name: string; file_type: string; file_size: number | null }[] = [];
    
    if (attachments.length > 0) {
      setIsUploadingFiles(true);
      try {
        for (const att of attachments) {
          if (att.file) {
            const fileExt = att.file.name.split('.').pop();
            const fileName = `${Date.now()}-${att.file.name}`;
            const filePath = `${user.id}/project-attachments/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('media')
              .upload(filePath, att.file);

            if (uploadError) { console.error('Upload error:', uploadError); continue; }

            const { data: { publicUrl } } = supabase.storage
              .from('media')
              .getPublicUrl(filePath);

            if (!coverImageUrl && att.type === 'image') coverImageUrl = publicUrl;
            uploadedAttachments.push({ file_url: publicUrl, file_name: att.name, file_type: att.type, file_size: att.file.size });
          } else if (att.url) {
            uploadedAttachments.push({ file_url: att.url, file_name: att.name, file_type: att.type, file_size: null });
          }
        }
      } finally {
        setIsUploadingFiles(false);
      }
    }

    createProject({
      title,
      description,
      total_budget: projectType === 'volunteer' ? 0 : budgetNum,
      timeline_start: timelineStart,
      timeline_end: timelineEnd,
      cover_image_url: coverImageUrl,
      expected_outcome: isPrivate ? undefined : (selectedOutcomes.join(', ') || undefined),
      budget_range: budgetRange || undefined,
      equipment_needed: equipmentNeeded || undefined,
      location_secured: locationSecured,
      venue: venue || undefined,
      props_needed: propsNeeded || undefined,
      sponsorship_needed: sponsorshipNeeded,
      vendors_needed: vendorsNeeded,
      is_moodboard_public: isMoodboardPublic,
      deliverables: validDeliverables,
      allow_custom_roles: allowCustomRoles,
      is_private: isPrivate,
      roles: validRoles,
      milestones: validMilestones,
    }, {
      onSuccess: async (project: any) => {
        // Upload attachments to project_attachments table
        if (uploadedAttachments.length > 0) {
          await (supabase.from('project_attachments') as any)
            .insert(uploadedAttachments.map(a => ({
              project_id: project.id,
              uploaded_by: user.id,
              ...a,
            })));
        }
        setOpen(false);
        resetForm();
      }
    });
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setProjectType('volunteer');
    setTotalBudget('');
    setCreditsReward(25);
    setIsPrivate(false);
    setSelectedOutcomes([]);
    setAttachments([]);
    setLinkUrl('');
    setIsMoodboardPublic(false);
    setBudgetRange('');
    setEquipmentNeeded('');
    setLocationSecured(false);
    setVenue('');
    setPropsNeeded('');
    setSponsorshipNeeded(false);
    setVendorsNeeded(false);
    setStartDate('');
    setStartTime('');
    setEndDate('');
    setEndTime('');
    setMilestones(DEFAULT_PHASES.map(p => ({ title: p.title, phase: p.phase, due_date: '' })));
    setRoles([{ role_name: '', description: '', payout_amount: 0, slots_available: 1 }]);
    setAllowCustomRoles(false);
    setDeliverables([{ type: '', publish_date: '', publish_location: '' }]);
  };

  const canSubmit = title.trim() && (
    projectType === 'volunteer' || 
    (projectType === 'paid' && budgetNum > 0) ||
    (projectType === 'hybrid' && (budgetNum > 0 || creditsReward > 0))
  );

  const fileTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      image: 'bg-blue-500/20 text-blue-400',
      pdf: 'bg-red-500/20 text-red-400',
      video: 'bg-purple-500/20 text-purple-400',
      doc: 'bg-amber-500/20 text-amber-400',
      zip: 'bg-emerald-500/20 text-emerald-400',
      link: 'bg-cyan-500/20 text-cyan-400',
    };
    return colors[type] || 'bg-muted text-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent 
        className="max-w-2xl max-h-[85vh] overflow-y-auto pb-24 sm:pb-8"
        aria-describedby="create-project-description"
      >
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <p id="create-project-description" className="text-sm text-muted-foreground">
            Set up your project details, budget, timeline, and roles needed.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Project Title *</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Music Video Production" required />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your project, vision, and what you're looking for..." rows={3} />
            </div>
          </div>

          {/* Project Visibility */}
          <div className="space-y-3">
            <Label>Project Visibility</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={cn(
                  "p-3 rounded-lg border text-center transition-all text-sm",
                  !isPrivate ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                <FolderKanban className="h-5 w-5 mx-auto mb-1" />
                Public Project
              </button>
              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={cn(
                  "p-3 rounded-lg border text-center transition-all text-sm",
                  isPrivate ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 text-muted-foreground"
                )}
              >
                <Lock className="h-5 w-5 mx-auto mb-1" />
                Private Client
              </button>
            </div>
            {isPrivate && (
              <p className="text-xs text-muted-foreground">This project will only be visible to you and invited clients. It won't appear in the public browse feed.</p>
            )}
          </div>

          {/* Expected Outcome (only for public) */}
          {!isPrivate && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Target className="h-4 w-4" /> Expected Outcome</Label>
            <div className="flex flex-wrap gap-2">
              {EXPECTED_OUTCOMES.map(outcome => (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => toggleOutcome(outcome)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border transition-all",
                    selectedOutcomes.includes(outcome)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {outcome}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Mood Board / Visual References */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2"><Image className="h-4 w-4" /> Visual References / Mood Board</Label>
            <p className="text-xs text-muted-foreground">Upload images, PDFs, docs, ZIPs, or paste links (Figma, YouTube, Google Drive)</p>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Drag & drop files here or</p>
                <label className="cursor-pointer">
                  <span className="text-sm text-primary hover:underline">browse files</span>
                  <input type="file" className="hidden" multiple accept="image/*,.pdf,.doc,.docx,.zip,.mp4,.mov" onChange={handleFileUpload} />
                </label>
              </div>
            </div>

            {/* Link input */}
            <div className="flex gap-2">
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Paste a link (Figma, YouTube, Google Drive...)"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addLink} disabled={!linkUrl.trim()}>
                <Link className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {attachments.map((att, i) => (
                  <div key={i} className="relative border border-border rounded-lg p-2 group">
                    {att.preview ? (
                      <img src={att.preview} alt={att.name} className="w-full h-20 object-cover rounded" />
                    ) : (
                      <div className="w-full h-20 bg-muted/30 rounded flex items-center justify-center">
                        {att.type === 'pdf' && <FileText className="h-8 w-8 text-red-400" />}
                        {att.type === 'video' && <Film className="h-8 w-8 text-purple-400" />}
                        {att.type === 'zip' && <Package className="h-8 w-8 text-emerald-400" />}
                        {att.type === 'link' && <Link className="h-8 w-8 text-cyan-400" />}
                        {att.type === 'doc' && <FileText className="h-8 w-8 text-amber-400" />}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <Badge className={cn('text-[10px]', fileTypeBadge(att.type))}>{att.type.toUpperCase()}</Badge>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{att.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Public toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="moodboard-public" className="text-sm">Make Mood Board Public</Label>
              <Switch id="moodboard-public" checked={isMoodboardPublic} onCheckedChange={setIsMoodboardPublic} />
            </div>
          </div>

          {/* Compensation Type */}
          <div className="space-y-3">
            <Label>Compensation Type *</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['volunteer', 'paid', 'hybrid'] as ProjectType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setProjectType(type)}
                  className={cn(
                    "p-3 rounded-lg border text-center transition-all",
                    projectType === type ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                  )}
                >
                  {type === 'volunteer' && <Coins className="h-5 w-5 mx-auto mb-1" />}
                  {type === 'paid' && <DollarSign className="h-5 w-5 mx-auto mb-1" />}
                  {type === 'hybrid' && <div className="flex justify-center gap-1 mb-1"><DollarSign className="h-4 w-4" /><Coins className="h-4 w-4" /></div>}
                  <span className="text-sm font-medium capitalize">{type === 'volunteer' ? 'LC Credits Only' : type === 'paid' ? 'Paid' : 'Hybrid'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          {(projectType === 'paid' || projectType === 'hybrid') && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="budget">Total Budget (USD)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="budget" type="number" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} placeholder="5000" className="pl-9" min={0} step={100} />
                </div>
              </div>
              {budgetNum > 0 && (
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-muted-foreground">Budget Allocation</span>
                    <span className={remaining < 0 ? 'text-red-400' : 'text-muted-foreground'}>
                      {remaining >= 0 ? `$${remaining.toLocaleString()} remaining` : `$${Math.abs(remaining).toLocaleString()} over budget`}
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-300", remaining < 0 ? 'bg-red-500' : 'bg-gradient-to-r from-primary to-primary/60')} style={{ width: `${Math.min((totalRolePayout / budgetNum) * 100, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LC Credits Reward */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2"><Coins className="h-4 w-4 text-primary" /> LC Credits Reward</Label>
            <p className="text-xs text-muted-foreground mb-3">Award LC Credits to collaborators (max 100)</p>
            <Slider value={[creditsReward]} onValueChange={(v) => setCreditsReward(v[0])} max={100} min={5} step={5} />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">5 (Simple)</span>
              <span className="font-medium text-primary">{creditsReward} LC</span>
              <span className="text-muted-foreground">100 (Complex)</span>
            </div>
          </div>

          {/* Budget & Resources */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2"><Wrench className="h-4 w-4" /> Budget & Resources</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm text-muted-foreground">Budget Range</Label>
                <Select value={budgetRange} onValueChange={setBudgetRange}>
                  <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                  <SelectContent>
                    {BUDGET_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Equipment Needed</Label>
                <Input value={equipmentNeeded} onChange={(e) => setEquipmentNeeded(e.target.value)} placeholder="Camera, lights, etc." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <Label className="text-sm">Location Secured?</Label>
                <Switch checked={locationSecured} onCheckedChange={setLocationSecured} />
              </div>
              {locationSecured && (
                <div>
                  <Label className="text-sm text-muted-foreground">Venue</Label>
                  <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue name / address" />
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Props Needed</Label>
              <Input value={propsNeeded} onChange={(e) => setPropsNeeded(e.target.value)} placeholder="Props, wardrobe, etc." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <Label className="text-sm">Sponsorship Needed?</Label>
                <Switch checked={sponsorshipNeeded} onCheckedChange={setSponsorshipNeeded} />
              </div>
              <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                <Label className="text-sm">Vendors Needed?</Label>
                <Switch checked={vendorsNeeded} onCheckedChange={setVendorsNeeded} />
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Project Timeline</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Start Time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">End Time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><Milestone className="h-4 w-4" /> Milestones</Label>
              <Button type="button" variant="outline" size="sm" onClick={addMilestone}>
                <Plus className="h-4 w-4 mr-1" /> Custom
              </Button>
            </div>
            <div className="space-y-2">
              {milestones.map((ms, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted/20 rounded-lg p-3">
                  <div className="flex-1">
                    <Input
                      value={ms.title}
                      onChange={(e) => updateMilestone(i, 'title', e.target.value)}
                      placeholder="Milestone name"
                      className="mb-1"
                    />
                  </div>
                  <Input
                    type="date"
                    value={ms.due_date}
                    onChange={(e) => updateMilestone(i, 'due_date', e.target.value)}
                    className="w-40"
                  />
                  {ms.phase === 'custom' && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeMilestone(i)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Roles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><Users2 className="h-4 w-4" /> Roles Needed</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRole}>
                <Plus className="h-4 w-4 mr-1" /> Add Role
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <Label className="text-sm">Allow custom role proposals</Label>
                <p className="text-xs text-muted-foreground">Let applicants define how they'd like to contribute</p>
              </div>
              <Switch checked={allowCustomRoles} onCheckedChange={setAllowCustomRoles} />
            </div>

            <div className="space-y-3">
              {roles.map((role, index) => (
                <div key={index} className="bg-muted/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Role {index + 1}</span>
                    {roles.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeRole(index)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <Input value={role.role_name} onChange={(e) => updateRole(index, 'role_name', e.target.value)} placeholder="Role name (e.g., Director)" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Input value={role.description} onChange={(e) => updateRole(index, 'description', e.target.value)} placeholder="Brief description" />
                    </div>
                    {(projectType === 'paid' || projectType === 'hybrid') && (
                      <div>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="number" value={role.payout_amount || ''} onChange={(e) => updateRole(index, 'payout_amount', parseFloat(e.target.value) || 0)} placeholder="Payout" className="pl-9" min={0} />
                        </div>
                      </div>
                    )}
                    <div>
                      <Input type="number" value={role.slots_available} onChange={(e) => updateRole(index, 'slots_available', parseInt(e.target.value) || 1)} placeholder="Slots" min={1} />
                      <span className="text-xs text-muted-foreground">slots available</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deliverables */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><Package className="h-4 w-4" /> Deliverables</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDeliverable}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {deliverables.map((d, i) => (
              <div key={i} className="bg-muted/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Select value={d.type} onValueChange={(v) => updateDeliverable(i, 'type', v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="What will be delivered?" /></SelectTrigger>
                    <SelectContent>
                      {DELIVERABLE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {deliverables.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeDeliverable(i)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Publish Date</Label>
                    <Input type="date" value={d.publish_date} onChange={(e) => updateDeliverable(i, 'publish_date', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Where Published</Label>
                    <Input value={d.publish_location} onChange={(e) => updateDeliverable(i, 'publish_location', e.target.value)} placeholder="Instagram, YouTube..." />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 pb-6 border-t bg-background mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isCreating || isUploadingFiles || !canSubmit}>
              {isUploadingFiles ? 'Uploading files...' : isCreating ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
