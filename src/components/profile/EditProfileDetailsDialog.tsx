import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Loader2, Crown, Star, Heart, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Item {
  id: string;
  name: string;
  category: string | null;
}

interface CustomEntry {
  name: string;
  description: string;
}

interface EditProfileDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSkills: Array<{ id: string; name: string; description?: string | null; isCustom?: boolean }>;
  currentPassions: Array<{ id: string; name: string; description?: string | null; isCustom?: boolean }>;
  currentRoles: Array<{ id: string; name: string; description?: string | null; isCustom?: boolean }>;
}

export function EditProfileDetailsDialog({
  open,
  onOpenChange,
  currentSkills,
  currentPassions,
  currentRoles,
}: EditProfileDetailsDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('roles');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [allSkills, setAllSkills] = useState<Item[]>([]);
  const [allPassions, setAllPassions] = useState<Item[]>([]);
  const [allRoles, setAllRoles] = useState<Item[]>([]);

  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [selectedPassionIds, setSelectedPassionIds] = useState<Set<string>>(new Set());
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());

  const [skillDescriptions, setSkillDescriptions] = useState<Record<string, string>>({});
  const [passionDescriptions, setPassionDescriptions] = useState<Record<string, string>>({});
  const [roleDescriptions, setRoleDescriptions] = useState<Record<string, string>>({});

  // Custom entries
  const [customSkills, setCustomSkills] = useState<CustomEntry[]>([]);
  const [customPassions, setCustomPassions] = useState<CustomEntry[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomEntry[]>([]);

  // New custom input
  const [newCustomSkill, setNewCustomSkill] = useState('');
  const [newCustomPassion, setNewCustomPassion] = useState('');
  const [newCustomRole, setNewCustomRole] = useState('');

  useEffect(() => {
    if (open) {
      fetchAllOptions();
      setSelectedSkillIds(new Set(currentSkills.filter(s => !s.isCustom).map(s => s.id)));
      setSelectedPassionIds(new Set(currentPassions.filter(p => !p.isCustom).map(p => p.id)));
      setSelectedRoleIds(new Set(currentRoles.filter(r => !r.isCustom).map(r => r.id)));

      const sd: Record<string, string> = {};
      currentSkills.filter(s => !s.isCustom).forEach(s => { if (s.description) sd[s.id] = s.description; });
      setSkillDescriptions(sd);

      const pd: Record<string, string> = {};
      currentPassions.filter(p => !p.isCustom).forEach(p => { if (p.description) pd[p.id] = p.description; });
      setPassionDescriptions(pd);

      const rd: Record<string, string> = {};
      currentRoles.filter(r => !r.isCustom).forEach(r => { if (r.description) rd[r.id] = r.description; });
      setRoleDescriptions(rd);

      // Load existing custom entries
      setCustomSkills(currentSkills.filter(s => s.isCustom).map(s => ({ name: s.name, description: s.description || '' })));
      setCustomPassions(currentPassions.filter(p => p.isCustom).map(p => ({ name: p.name, description: p.description || '' })));
      setCustomRoles(currentRoles.filter(r => r.isCustom).map(r => ({ name: r.name, description: r.description || '' })));

      setNewCustomSkill('');
      setNewCustomPassion('');
      setNewCustomRole('');
    }
  }, [open, currentSkills, currentPassions, currentRoles]);

  const fetchAllOptions = async () => {
    setLoading(true);
    try {
      const [skillsRes, passionsRes, rolesRes] = await Promise.all([
        supabase.from('skills').select('*').order('category'),
        supabase.from('passions').select('*').order('category'),
        supabase.from('creative_roles').select('*').order('category'),
      ]);
      if (skillsRes.data) setAllSkills(skillsRes.data);
      if (passionsRes.data) setAllPassions(passionsRes.data);
      if (rolesRes.data) setAllRoles(rolesRes.data);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id: string, type: 'skill' | 'passion' | 'role') => {
    const setFn = type === 'skill' ? setSelectedSkillIds : type === 'passion' ? setSelectedPassionIds : setSelectedRoleIds;
    setFn(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addCustomEntry = (type: 'skill' | 'passion' | 'role') => {
    if (type === 'skill' && newCustomSkill.trim()) {
      setCustomSkills(prev => [...prev, { name: newCustomSkill.trim(), description: '' }]);
      setNewCustomSkill('');
    } else if (type === 'passion' && newCustomPassion.trim()) {
      setCustomPassions(prev => [...prev, { name: newCustomPassion.trim(), description: '' }]);
      setNewCustomPassion('');
    } else if (type === 'role' && newCustomRole.trim()) {
      setCustomRoles(prev => [...prev, { name: newCustomRole.trim(), description: '' }]);
      setNewCustomRole('');
    }
  };

  const removeCustomEntry = (type: 'skill' | 'passion' | 'role', index: number) => {
    if (type === 'skill') setCustomSkills(prev => prev.filter((_, i) => i !== index));
    else if (type === 'passion') setCustomPassions(prev => prev.filter((_, i) => i !== index));
    else setCustomRoles(prev => prev.filter((_, i) => i !== index));
  };

  const updateCustomDescription = (type: 'skill' | 'passion' | 'role', index: number, desc: string) => {
    const setFn = type === 'skill' ? setCustomSkills : type === 'passion' ? setCustomPassions : setCustomRoles;
    setFn(prev => prev.map((entry, i) => i === index ? { ...entry, description: desc } : entry));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Skills: predefined + custom
      await supabase.from('user_skills').delete().eq('user_id', user.id);
      const skillInserts = [
        ...Array.from(selectedSkillIds).map(id => ({
          user_id: user.id,
          skill_id: id,
          description: skillDescriptions[id] || null,
          custom_name: null,
        })),
        ...customSkills.map(c => ({
          user_id: user.id,
          skill_id: null,
          description: c.description || null,
          custom_name: c.name,
        })),
      ];
      if (skillInserts.length > 0) await supabase.from('user_skills').insert(skillInserts);

      // Passions
      await supabase.from('user_passions').delete().eq('user_id', user.id);
      const passionInserts = [
        ...Array.from(selectedPassionIds).map(id => ({
          user_id: user.id,
          passion_id: id,
          description: passionDescriptions[id] || null,
          custom_name: null,
        })),
        ...customPassions.map(c => ({
          user_id: user.id,
          passion_id: null,
          description: c.description || null,
          custom_name: c.name,
        })),
      ];
      if (passionInserts.length > 0) await supabase.from('user_passions').insert(passionInserts);

      // Roles
      await supabase.from('user_creative_roles').delete().eq('user_id', user.id);
      const roleInserts = [
        ...Array.from(selectedRoleIds).map(id => ({
          user_id: user.id,
          role_id: id,
          description: roleDescriptions[id] || null,
          custom_name: null,
        })),
        ...customRoles.map(c => ({
          user_id: user.id,
          role_id: null,
          description: c.description || null,
          custom_name: c.name,
        })),
      ];
      if (roleInserts.length > 0) await supabase.from('user_creative_roles').insert(roleInserts);

      queryClient.invalidateQueries({ queryKey: ['user-skills', user.id] });
      queryClient.invalidateQueries({ queryKey: ['user-passions', user.id] });
      queryClient.invalidateQueries({ queryKey: ['user-creative-roles', user.id] });

      toast.success('Profile updated!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving profile details:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const groupByCategory = (items: Item[]) => {
    return items.reduce((acc, item) => {
      const cat = item.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, Item[]>);
  };

  const renderItemGrid = (
    items: Item[],
    selectedIds: Set<string>,
    type: 'skill' | 'passion' | 'role',
    descriptions: Record<string, string>,
    setDescriptions: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    customs: CustomEntry[],
    newCustomValue: string,
    setNewCustomValue: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const grouped = groupByCategory(items);

    return (
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category}>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">{category}</h4>
            <div className="flex flex-wrap gap-2">
              {categoryItems.map(item => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id, type)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                      isSelected
                        ? type === 'role'
                          ? 'bg-primary text-primary-foreground'
                          : type === 'skill'
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-destructive/20 text-destructive border border-destructive/30'
                        : 'bg-secondary text-secondary-foreground hover:bg-accent/50'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    {item.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Custom entries */}
        {customs.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Your Custom Entries</h4>
            <div className="flex flex-wrap gap-2">
              {customs.map((c, i) => (
                <span
                  key={i}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                    type === 'role'
                      ? 'bg-primary text-primary-foreground'
                      : type === 'skill'
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-destructive/20 text-destructive border border-destructive/30'
                  }`}
                >
                  {c.name}
                  <button onClick={() => removeCustomEntry(type, i)} className="ml-1 hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Add custom input */}
        <div className="pt-3 border-t border-border/50">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            Don't see yours? Add your own
          </h4>
          <div className="flex gap-2">
            <Input
              value={newCustomValue}
              onChange={(e) => setNewCustomValue(e.target.value)}
              placeholder={`Type your own ${type}...`}
              className="h-8 text-xs flex-1"
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomEntry(type);
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-3"
              onClick={() => addCustomEntry(type)}
              disabled={!newCustomValue.trim()}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Description inputs for selected + custom items */}
        {(Array.from(selectedIds).length > 0 || customs.length > 0) && (
          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground">
              Add your own description (optional)
            </h4>
            {items
              .filter(item => selectedIds.has(item.id))
              .map(item => (
                <div key={item.id}>
                  <label className="text-xs font-medium text-foreground mb-1 block">{item.name}</label>
                  <Textarea
                    value={descriptions[item.id] || ''}
                    onChange={(e) => setDescriptions(prev => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder={`Describe how ${item.name} relates to you...`}
                    className="min-h-[60px] text-xs placeholder:text-left"
                    maxLength={200}
                  />
                </div>
              ))}
            {customs.map((c, i) => (
              <div key={`custom-${i}`}>
                <label className="text-xs font-medium text-foreground mb-1 block">{c.name}</label>
                <Textarea
                  value={c.description}
                  onChange={(e) => updateCustomDescription(type, i, e.target.value)}
                  placeholder={`Describe what ${c.name} means to you...`}
                  className="min-h-[60px] text-xs placeholder:text-left"
                  maxLength={200}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Edit Profile Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="roles" className="gap-1">
                  <Crown className="w-3 h-3" />
                  Roles
                </TabsTrigger>
                <TabsTrigger value="skills" className="gap-1">
                  <Star className="w-3 h-3" />
                  Skills
                </TabsTrigger>
                <TabsTrigger value="passions" className="gap-1">
                  <Heart className="w-3 h-3" />
                  Passions
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[350px] mt-4 pr-4">
                <TabsContent value="roles" className="mt-0">
                  <p className="text-xs text-muted-foreground mb-3">
                    Select roles that describe what you do ({selectedRoleIds.size + customRoles.length} selected)
                  </p>
                  {renderItemGrid(allRoles, selectedRoleIds, 'role', roleDescriptions, setRoleDescriptions, customRoles, newCustomRole, setNewCustomRole)}
                </TabsContent>

                <TabsContent value="skills" className="mt-0">
                  <p className="text-xs text-muted-foreground mb-3">
                    Select skills you bring to the table ({selectedSkillIds.size + customSkills.length} selected)
                  </p>
                  {renderItemGrid(allSkills, selectedSkillIds, 'skill', skillDescriptions, setSkillDescriptions, customSkills, newCustomSkill, setNewCustomSkill)}
                </TabsContent>

                <TabsContent value="passions" className="mt-0">
                  <p className="text-xs text-muted-foreground mb-3">
                    Select passions that drive you ({selectedPassionIds.size + customPassions.length} selected)
                  </p>
                  {renderItemGrid(allPassions, selectedPassionIds, 'passion', passionDescriptions, setPassionDescriptions, customPassions, newCustomPassion, setNewCustomPassion)}
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
