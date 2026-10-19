import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface MemberOption {
  user_id: string;
  project_role_name?: string | null;
  profile?: { display_name: string | null; avatar_url?: string | null };
}

interface CreateSubgroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  mainConversationId: string;
  members: MemberOption[];
  onCreated?: (conversationId: string) => void;
}

export function CreateSubgroupDialog({
  open,
  onOpenChange,
  projectId,
  mainConversationId,
  members,
  onCreated,
}: CreateSubgroupDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (userId: string) => {
    setSelected((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  const create = async () => {
    if (!user) return;
    const others = selected.filter((id) => id !== user.id);
    if (!name.trim() || others.length === 0) {
      toast.error('Name the subgroup and pick at least one other member');
      return;
    }
    setSaving(true);
    try {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .insert({
          type: 'group',
          name: name.trim(),
          created_by: user.id,
          project_id: projectId,
          parent_conversation_id: mainConversationId,
          visibility: 'private',
        })
        .select('id')
        .single();
      if (error) throw error;

      const memberIds = [user.id, ...others];
      const { error: memberError } = await supabase.from('conversation_participants').insert(
        memberIds.map((userId) => ({
          conversation_id: conversation.id,
          user_id: userId,
          role: userId === user.id ? 'owner' as const : 'member' as const,
          project_role_name: members.find((member) => member.user_id === userId)?.project_role_name || null,
        })),
      );
      if (memberError) throw memberError;

      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Subgroup created');
      setName('');
      setSelected([]);
      onOpenChange(false);
      onCreated?.(conversation.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the subgroup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New subgroup</DialogTitle>
          <DialogDescription>
            Pick the people who need this thread. The project owner can still read it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="subgroup-name">Name</Label>
            <Input
              id="subgroup-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Designer, models, MUA"
            />
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {members.filter((member) => member.user_id !== user?.id).map((member) => (
              <label key={member.user_id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <input
                  type="checkbox"
                  checked={selected.includes(member.user_id)}
                  onChange={() => toggle(member.user_id)}
                />
                <span className="text-sm">
                  {member.profile?.display_name || 'Member'}
                  {member.project_role_name ? ` · ${member.project_role_name}` : ''}
                </span>
              </label>
            ))}
          </div>
          <Button type="button" onClick={create} disabled={saving} className="w-full">
            {saving ? 'Creating...' : 'Create subgroup'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
