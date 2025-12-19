import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, Loader2, Crown, Star, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Item {
  id: string;
  name: string;
  category: string | null;
}

interface EditProfileDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSkills: Item[];
  currentPassions: Item[];
  currentRoles: Item[];
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

  // All available options
  const [allSkills, setAllSkills] = useState<Item[]>([]);
  const [allPassions, setAllPassions] = useState<Item[]>([]);
  const [allRoles, setAllRoles] = useState<Item[]>([]);

  // Selected items (by ID)
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [selectedPassionIds, setSelectedPassionIds] = useState<Set<string>>(new Set());
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchAllOptions();
      // Initialize selected from current
      setSelectedSkillIds(new Set(currentSkills.map(s => s.id)));
      setSelectedPassionIds(new Set(currentPassions.map(p => p.id)));
      setSelectedRoleIds(new Set(currentRoles.map(r => r.id)));
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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Update skills
      await supabase.from('user_skills').delete().eq('user_id', user.id);
      if (selectedSkillIds.size > 0) {
        await supabase.from('user_skills').insert(
          Array.from(selectedSkillIds).map(id => ({ user_id: user.id, skill_id: id }))
        );
      }

      // Update passions
      await supabase.from('user_passions').delete().eq('user_id', user.id);
      if (selectedPassionIds.size > 0) {
        await supabase.from('user_passions').insert(
          Array.from(selectedPassionIds).map(id => ({ user_id: user.id, passion_id: id }))
        );
      }

      // Update creative roles
      await supabase.from('user_creative_roles').delete().eq('user_id', user.id);
      if (selectedRoleIds.size > 0) {
        await supabase.from('user_creative_roles').insert(
          Array.from(selectedRoleIds).map(id => ({ user_id: user.id, role_id: id }))
        );
      }

      // Invalidate queries
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
    type: 'skill' | 'passion' | 'role'
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
                    Select roles that describe what you do ({selectedRoleIds.size} selected)
                  </p>
                  {renderItemGrid(allRoles, selectedRoleIds, 'role')}
                </TabsContent>

                <TabsContent value="skills" className="mt-0">
                  <p className="text-xs text-muted-foreground mb-3">
                    Select up to 10 skills you bring to the table ({selectedSkillIds.size}/10)
                  </p>
                  {renderItemGrid(allSkills, selectedSkillIds, 'skill')}
                </TabsContent>

                <TabsContent value="passions" className="mt-0">
                  <p className="text-xs text-muted-foreground mb-3">
                    Select passions that drive you ({selectedPassionIds.size} selected)
                  </p>
                  {renderItemGrid(allPassions, selectedPassionIds, 'passion')}
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
