import React, { useState } from 'react';
import { Plus, Trash2, DollarSign, Coins, Upload, X, Image } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ProjectType = 'paid' | 'volunteer' | 'hybrid';

interface RoleInput {
  role_name: string;
  description: string;
  payout_amount: number;
  slots_available: number;
}

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
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('volunteer');
  const [totalBudget, setTotalBudget] = useState('');
  const [creditsReward, setCreditsReward] = useState(25);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [moodboardUrl, setMoodboardUrl] = useState('');
  const [isUploadingMoodboard, setIsUploadingMoodboard] = useState(false);
  const [roles, setRoles] = useState<RoleInput[]>([
    { role_name: '', description: '', payout_amount: 0, slots_available: 1 }
  ]);

  const addRole = () => {
    setRoles([...roles, { role_name: '', description: '', payout_amount: 0, slots_available: 1 }]);
  };

  const removeRole = (index: number) => {
    setRoles(roles.filter((_, i) => i !== index));
  };

  const updateRole = (index: number, field: keyof RoleInput, value: string | number) => {
    const updated = [...roles];
    updated[index] = { ...updated[index], [field]: value };
    setRoles(updated);
  };

  const handleMoodboardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploadingMoodboard(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `moodboard-${Date.now()}.${fileExt}`;
      const filePath = `project-moodboards/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      setMoodboardUrl(publicUrl);
      toast.success('Moodboard uploaded!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload moodboard');
    } finally {
      setIsUploadingMoodboard(false);
    }
  };

  const removeMoodboard = () => {
    setMoodboardUrl('');
  };

  const totalRolePayout = roles.reduce((sum, role) => sum + (role.payout_amount * role.slots_available), 0);
  const budgetNum = parseFloat(totalBudget) || 0;
  const remaining = budgetNum - totalRolePayout;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validRoles = roles.filter(r => r.role_name.trim());
    
    // Combine date and time into ISO strings
    const timelineStart = startDate ? `${startDate}${startTime ? `T${startTime}` : 'T00:00'}` : undefined;
    const timelineEnd = endDate ? `${endDate}${endTime ? `T${endTime}` : 'T23:59'}` : undefined;
    
    createProject({
      title,
      description,
      total_budget: projectType === 'volunteer' ? 0 : budgetNum,
      timeline_start: timelineStart,
      timeline_end: timelineEnd,
      cover_image_url: moodboardUrl || undefined,
      roles: validRoles
    }, {
      onSuccess: () => {
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
    setStartDate('');
    setStartTime('');
    setEndDate('');
    setEndTime('');
    setMoodboardUrl('');
    setRoles([{ role_name: '', description: '', payout_amount: 0, slots_available: 1 }]);
  };

  const canSubmit = title.trim() && (
    projectType === 'volunteer' || 
    (projectType === 'paid' && budgetNum > 0) ||
    (projectType === 'hybrid' && (budgetNum > 0 || creditsReward > 0))
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto pb-24 sm:pb-8">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Music Video Production"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your project, vision, and what you're looking for..."
                rows={3}
              />
            </div>
          </div>

          {/* Moodboard / Visual Reference */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Visual Reference / Moodboard (Optional)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Upload an image to help collaborators understand your vision
            </p>
            
            {moodboardUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img 
                  src={moodboardUrl} 
                  alt="Moodboard" 
                  className="w-full h-48 object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={removeMoodboard}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {isUploadingMoodboard ? 'Uploading...' : 'Click to upload moodboard'}
                  </p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleMoodboardUpload}
                  disabled={isUploadingMoodboard}
                />
              </label>
            )}
          </div>

          {/* Project Type */}
          <div className="space-y-3">
            <Label>Compensation Type *</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setProjectType('volunteer')}
                className={`p-3 rounded-lg border text-center transition-all ${
                  projectType === 'volunteer' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Coins className="h-5 w-5 mx-auto mb-1" />
                <span className="text-sm font-medium">LC Credits Only</span>
              </button>
              <button
                type="button"
                onClick={() => setProjectType('paid')}
                className={`p-3 rounded-lg border text-center transition-all ${
                  projectType === 'paid' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <DollarSign className="h-5 w-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Paid</span>
              </button>
              <button
                type="button"
                onClick={() => setProjectType('hybrid')}
                className={`p-3 rounded-lg border text-center transition-all ${
                  projectType === 'hybrid' 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex justify-center gap-1 mb-1">
                  <DollarSign className="h-4 w-4" />
                  <Coins className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Hybrid</span>
              </button>
            </div>
          </div>

          {/* Budget - only show for paid/hybrid */}
          {(projectType === 'paid' || projectType === 'hybrid') && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="budget">Total Budget (USD) {projectType === 'paid' ? '*' : ''}</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="budget"
                    type="number"
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(e.target.value)}
                    placeholder="5000"
                    className="pl-9"
                    min={0}
                    step={100}
                    required={projectType === 'paid'}
                  />
                </div>
              </div>

              {/* Budget breakdown visualization */}
              {budgetNum > 0 && (
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-muted-foreground">Budget Allocation</span>
                    <span className={remaining < 0 ? 'text-red-400' : 'text-muted-foreground'}>
                      {remaining >= 0 ? `$${remaining.toLocaleString()} remaining` : `$${Math.abs(remaining).toLocaleString()} over budget`}
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        remaining < 0 ? 'bg-red-500' : 'bg-gradient-to-r from-primary to-primary/60'
                      }`}
                      style={{ width: `${Math.min((totalRolePayout / budgetNum) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LC Credits Reward */}
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                LC Credits Reward
              </Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Award LC Credits to collaborators based on project difficulty (max 100)
              </p>
              <div className="space-y-3">
                <Slider
                  value={[creditsReward]}
                  onValueChange={(value) => setCreditsReward(value[0])}
                  max={100}
                  min={5}
                  step={5}
                  className="w-full"
                />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">5 (Simple)</span>
                  <span className="font-medium text-primary">{creditsReward} LC</span>
                  <span className="text-muted-foreground">100 (Complex)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-4">
            <Label>Project Timeline</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-sm text-muted-foreground">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime" className="text-sm text-muted-foreground">Start Time (optional)</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-sm text-muted-foreground">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime" className="text-sm text-muted-foreground">End Time (optional)</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Roles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Roles Needed</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRole}>
                <Plus className="h-4 w-4 mr-1" />
                Add Role
              </Button>
            </div>

            <div className="space-y-3">
              {roles.map((role, index) => (
                <div key={index} className="bg-muted/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Role {index + 1}</span>
                    {roles.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRole(index)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <Input
                        value={role.role_name}
                        onChange={(e) => updateRole(index, 'role_name', e.target.value)}
                        placeholder="Role name (e.g., Director)"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Input
                        value={role.description}
                        onChange={(e) => updateRole(index, 'description', e.target.value)}
                        placeholder="Brief description"
                      />
                    </div>
                    {(projectType === 'paid' || projectType === 'hybrid') && (
                      <div>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            value={role.payout_amount || ''}
                            onChange={(e) => updateRole(index, 'payout_amount', parseFloat(e.target.value) || 0)}
                            placeholder="Payout (optional)"
                            className="pl-9"
                            min={0}
                          />
                        </div>
                      </div>
                    )}
                    <div>
                      <Input
                        type="number"
                        value={role.slots_available}
                        onChange={(e) => updateRole(index, 'slots_available', parseInt(e.target.value) || 1)}
                        placeholder="Slots"
                        min={1}
                      />
                      <span className="text-xs text-muted-foreground">slots available</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 pb-6 border-t bg-background mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !canSubmit}>
              {isCreating ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
