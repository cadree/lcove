import React, { useState } from 'react';
import { Plus, Trash2, DollarSign, Coins } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface RoleInput {
  role_name: string;
  description: string;
  payout_amount: number;
  slots_available: number;
}

interface CreateProjectDialogProps {
  children: React.ReactNode;
}

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({ children }) => {
  const { createProject, isCreating } = useProjects();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [creditsReward, setCreditsReward] = useState(25);
  const [timelineStart, setTimelineStart] = useState('');
  const [timelineEnd, setTimelineEnd] = useState('');
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

  const totalRolePayout = roles.reduce((sum, role) => sum + (role.payout_amount * role.slots_available), 0);
  const budgetNum = parseFloat(totalBudget) || 0;
  const remaining = budgetNum - totalRolePayout;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validRoles = roles.filter(r => r.role_name.trim());
    
    createProject({
      title,
      description,
      total_budget: budgetNum,
      timeline_start: timelineStart || undefined,
      timeline_end: timelineEnd || undefined,
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
    setTotalBudget('');
    setCreditsReward(25);
    setTimelineStart('');
    setTimelineEnd('');
    setRoles([{ role_name: '', description: '', payout_amount: 0, slots_available: 1 }]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto pb-8">
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

          {/* Budget */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="budget">Total Budget (USD) *</Label>
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
                  required
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">Start Date</Label>
              <Input
                id="start"
                type="date"
                value={timelineStart}
                onChange={(e) => setTimelineStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end">End Date</Label>
              <Input
                id="end"
                type="date"
                value={timelineEnd}
                onChange={(e) => setTimelineEnd(e.target.value)}
              />
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
                    <div>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={role.payout_amount || ''}
                          onChange={(e) => updateRole(index, 'payout_amount', parseFloat(e.target.value) || 0)}
                          placeholder="Payout"
                          className="pl-9"
                          min={0}
                        />
                      </div>
                    </div>
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

          <div className="flex justify-end gap-3 pt-4 pb-4 border-t sticky bottom-0 bg-background">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !title || budgetNum <= 0}>
              {isCreating ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
