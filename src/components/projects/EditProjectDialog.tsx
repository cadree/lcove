import React, { useState, useEffect } from 'react';
import { Pencil, Plus, Trash2, Target, MapPin, Wrench, Calendar } from 'lucide-react';
import { Project, useProjects } from '@/hooks/useProjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const EXPECTED_OUTCOMES = ['Portfolio piece', 'Paid production', 'Experimental', 'Community collab'];
const BUDGET_RANGES = ['$0 (Volunteer)', '$1 - $500', '$500 - $2,000', '$2,000 - $5,000', '$5,000 - $10,000', '$10,000+'];
const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface RoleInput {
  id?: string;
  role_name: string;
  description: string;
  payout_amount: number;
  slots_available: number;
}

interface EditProjectDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditProjectDialog: React.FC<EditProjectDialogProps> = ({ project, open, onOpenChange }) => {
  const { updateProject, isUpdatingProject } = useProjects();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [status, setStatus] = useState('open');
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState('');
  const [equipmentNeeded, setEquipmentNeeded] = useState('');
  const [locationSecured, setLocationSecured] = useState(false);
  const [venue, setVenue] = useState('');
  const [propsNeeded, setPropsNeeded] = useState('');
  const [sponsorshipNeeded, setSponsorshipNeeded] = useState(false);
  const [vendorsNeeded, setVendorsNeeded] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allowCustomRoles, setAllowCustomRoles] = useState(false);
  const [roles, setRoles] = useState<RoleInput[]>([]);
  const [isSavingRoles, setIsSavingRoles] = useState(false);

  // Populate form when dialog opens
  useEffect(() => {
    if (open && project) {
      setTitle(project.title || '');
      setDescription(project.description || '');
      setTotalBudget(String(project.total_budget || 0));
      setCurrency(project.currency || 'USD');
      setStatus(project.status || 'open');
      setSelectedOutcomes(project.expected_outcome?.split(', ').filter(Boolean) || []);
      setBudgetRange(project.budget_range || '');
      setEquipmentNeeded(project.equipment_needed || '');
      setLocationSecured(project.location_secured || false);
      setVenue(project.venue || '');
      setPropsNeeded(project.props_needed || '');
      setSponsorshipNeeded(project.sponsorship_needed || false);
      setVendorsNeeded(project.vendors_needed || false);
      setStartDate(project.timeline_start ? project.timeline_start.split('T')[0] : '');
      setEndDate(project.timeline_end ? project.timeline_end.split('T')[0] : '');
      setAllowCustomRoles(project.allow_custom_roles || false);
      setRoles(
        project.roles?.map(r => ({
          id: r.id,
          role_name: r.role_name,
          description: r.description || '',
          payout_amount: r.payout_amount,
          slots_available: r.slots_available,
        })) || []
      );
    }
  }, [open, project]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const budgetNum = parseFloat(totalBudget) || 0;

    updateProject(
      {
        projectId: project.id,
        updates: {
          title,
          description: description || null,
          total_budget: budgetNum,
          currency,
          status,
          expected_outcome: selectedOutcomes.join(', ') || null,
          budget_range: budgetRange || null,
          equipment_needed: equipmentNeeded || null,
          location_secured: locationSecured,
          venue: venue || null,
          props_needed: propsNeeded || null,
          sponsorship_needed: sponsorshipNeeded,
          vendors_needed: vendorsNeeded,
          timeline_start: startDate ? `${startDate}T00:00` : null,
          timeline_end: endDate ? `${endDate}T23:59` : null,
          allow_custom_roles: allowCustomRoles,
        },
      },
      {
        onSuccess: async () => {
          // Sync roles
          setIsSavingRoles(true);
          try {
            const existingIds = roles.filter(r => r.id).map(r => r.id!);
            // Delete removed roles
            if (project.roles) {
              const deletedIds = project.roles.filter(r => !existingIds.includes(r.id)).map(r => r.id);
              if (deletedIds.length > 0) {
                await supabase.from('project_roles').delete().in('id', deletedIds);
              }
            }
            // Upsert roles
            for (const role of roles) {
              if (!role.role_name.trim()) continue;
              if (role.id) {
                await supabase.from('project_roles').update({
                  role_name: role.role_name,
                  description: role.description || null,
                  payout_amount: role.payout_amount,
                  slots_available: role.slots_available,
                }).eq('id', role.id);
              } else {
                await supabase.from('project_roles').insert({
                  project_id: project.id,
                  role_name: role.role_name,
                  description: role.description || null,
                  payout_amount: role.payout_amount,
                  slots_available: role.slots_available,
                });
              }
            }
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['my-projects'] });
          } catch (err: any) {
            toast.error('Failed to update roles: ' + err.message);
          } finally {
            setIsSavingRoles(false);
          }
          onOpenChange(false);
        },
      }
    );
  };

  const totalRolePayout = roles.reduce((sum, r) => sum + r.payout_amount * r.slots_available, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-y-auto pb-24 sm:pb-8"
        aria-describedby="edit-project-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Edit Project
          </DialogTitle>
          <p id="edit-project-description" className="text-sm text-muted-foreground">
            Modify your project details, budget, timeline, and roles.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Project Title *</Label>
              <Input id="edit-title" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Expected Outcome */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Target className="h-4 w-4" /> Expected Outcome</Label>
            <div className="flex flex-wrap gap-2">
              {EXPECTED_OUTCOMES.map(outcome => (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => toggleOutcome(outcome)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm border transition-all',
                    selectedOutcomes.includes(outcome)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {outcome}
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Total Budget</Label>
                <Input type="number" value={totalBudget} onChange={e => setTotalBudget(e.target.value)} min="0" step="1" />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Budget Range</Label>
              <Select value={budgetRange} onValueChange={setBudgetRange}>
                <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                <SelectContent>
                  {BUDGET_RANGES.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Timeline</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2"><Wrench className="h-4 w-4" /> Resources</Label>
            <div>
              <Label className="text-xs text-muted-foreground">Equipment Needed</Label>
              <Input value={equipmentNeeded} onChange={e => setEquipmentNeeded(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Venue</Label>
                <Input value={venue} onChange={e => setVenue(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={locationSecured} onCheckedChange={setLocationSecured} />
                <Label className="text-xs">Location Secured</Label>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Props Needed</Label>
              <Input value={propsNeeded} onChange={e => setPropsNeeded(e.target.value)} />
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={sponsorshipNeeded} onCheckedChange={setSponsorshipNeeded} />
                <Label className="text-xs">Sponsorship Needed</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={vendorsNeeded} onCheckedChange={setVendorsNeeded} />
                <Label className="text-xs">Vendors Needed</Label>
              </div>
            </div>
          </div>

          {/* Roles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Roles</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRole}>
                <Plus className="h-3 w-3 mr-1" /> Add Role
              </Button>
            </div>
            {roles.map((role, i) => (
              <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={role.role_name}
                    onChange={e => updateRole(i, 'role_name', e.target.value)}
                    placeholder="Role name"
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeRole(i)} className="shrink-0 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={role.description}
                  onChange={e => updateRole(i, 'description', e.target.value)}
                  placeholder="Description (optional)"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Payout</Label>
                    <Input type="number" value={role.payout_amount} onChange={e => updateRole(i, 'payout_amount', parseFloat(e.target.value) || 0)} min="0" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Slots</Label>
                    <Input type="number" value={role.slots_available} onChange={e => updateRole(i, 'slots_available', parseInt(e.target.value) || 1)} min="1" />
                  </div>
                </div>
              </div>
            ))}
            {roles.length > 0 && (
              <div className="text-xs text-muted-foreground text-right">
                Total role payout: <span className="font-medium text-foreground">${totalRolePayout.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={allowCustomRoles} onCheckedChange={setAllowCustomRoles} />
              <Label className="text-xs">Allow applicants to propose custom roles</Label>
            </div>
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={isUpdatingProject || isSavingRoles || !title.trim()}>
            {isUpdatingProject || isSavingRoles ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
