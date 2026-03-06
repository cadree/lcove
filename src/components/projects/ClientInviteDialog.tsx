import React, { useState } from 'react';
import { UserPlus, Search, X, Check, Clock, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useUserSearch } from '@/hooks/useUserSearch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ClientInviteDialogProps {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProjectClient {
  id: string;
  project_id: string;
  client_user_id: string;
  invited_by: string;
  status: string;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

export const ClientInviteDialog: React.FC<ClientInviteDialogProps> = ({
  projectId,
  projectTitle,
  open,
  onOpenChange,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults = [], isLoading: isSearching } = useUserSearch(searchQuery, open);

  // Fetch current clients
  const { data: clients = [] } = useQuery({
    queryKey: ['project-clients', projectId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('project_clients') as any)
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = (data || []).map((c: any) => c.client_user_id);
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      return (data || []).map((c: any) => ({
        ...c,
        profile: profiles?.find(p => p.user_id === c.client_user_id),
      })) as ProjectClient[];
    },
    enabled: open && !!projectId,
  });

  const inviteClient = useMutation({
    mutationFn: async (clientUserId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Insert client record
      const { error } = await (supabase
        .from('project_clients') as any)
        .insert({
          project_id: projectId,
          client_user_id: clientUserId,
          invited_by: user.id,
          status: 'invited',
        });

      if (error) throw error;

      // Create client chat
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'direct',
          name: `${projectTitle} – Client Chat`,
          created_by: user.id,
          visibility: 'private',
          project_id: projectId,
          is_client_chat: true,
        } as any)
        .select('id')
        .single();

      if (!convError && newConv) {
        await supabase.from('conversation_participants').insert([
          { conversation_id: newConv.id, user_id: user.id, role: 'owner' },
          { conversation_id: newConv.id, user_id: clientUserId, role: 'member' },
        ] as any);
      }

      // Send notification
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      await supabase.from('notifications').insert({
        user_id: clientUserId,
        type: 'project_client_invite',
        title: 'Client Invitation',
        body: `${profile?.display_name || 'A creator'} invited you as a client on "${projectTitle}"`,
        data: { project_id: projectId },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-clients', projectId] });
      setSearchQuery('');
      toast.success('Client invited!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to invite client');
    },
  });

  const removeClient = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await (supabase
        .from('project_clients') as any)
        .update({ status: 'removed' })
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-clients', projectId] });
      toast.success('Client removed');
    },
  });

  const clientUserIds = clients.map(c => c.client_user_id);
  const filteredResults = searchResults.filter(
    u => u.user_id !== user?.id && !clientUserIds.includes(u.user_id)
  );

  const statusBadge = (status: string) => {
    if (status === 'accepted') return <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">Active</Badge>;
    if (status === 'invited') return <Badge className="bg-amber-500/20 text-amber-400 text-[10px]"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby="client-invite-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Manage Clients
          </DialogTitle>
          <p id="client-invite-desc" className="text-sm text-muted-foreground">
            Invite clients to view project progress privately.
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search users to invite..."
            className="pl-9"
          />
        </div>

        {/* Search results */}
        {searchQuery.length >= 2 && (
          <div className="max-h-40 overflow-y-auto space-y-1">
            {isSearching ? (
              <p className="text-sm text-muted-foreground text-center py-3">Searching...</p>
            ) : filteredResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">No users found</p>
            ) : (
              filteredResults.map(u => (
                <div key={u.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{u.display_name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{u.display_name}</p>
                      {u.city && <p className="text-xs text-muted-foreground">{u.city}</p>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => inviteClient.mutate(u.user_id)}
                    disabled={inviteClient.isPending}
                  >
                    <Send className="h-3 w-3 mr-1" /> Invite
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Current clients */}
        {clients.filter(c => c.status !== 'removed').length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Current Clients</h4>
            {clients
              .filter(c => c.status !== 'removed')
              .map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 border border-border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{c.profile?.display_name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{c.profile?.display_name || 'User'}</p>
                      {statusBadge(c.status)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeClient.mutate(c.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
