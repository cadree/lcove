import React, { useState } from 'react';
import { UserPlus, Search, X, Clock, Send, Link, Copy, Mail, MessageCircle, Share2, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  client_user_id: string | null;
  client_token: string | null;
  client_name: string | null;
  client_email: string | null;
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
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

      const userIds = (data || []).filter((c: any) => c.client_user_id).map((c: any) => c.client_user_id);
      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data: p } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);
        profiles = p || [];
      }

      return (data || []).map((c: any) => ({
        ...c,
        profile: profiles.find(p => p.user_id === c.client_user_id),
      })) as ProjectClient[];
    },
    enabled: open && !!projectId,
  });

  // Invite existing user
  const inviteClient = useMutation({
    mutationFn: async (clientUserId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await (supabase.from('project_clients') as any).insert({
        project_id: projectId,
        client_user_id: clientUserId,
        invited_by: user.id,
        status: 'invited',
      });
      if (error) throw error;

      // Create client chat
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({ type: 'direct', name: `${projectTitle} – Client Chat`, created_by: user.id, visibility: 'private', project_id: projectId, is_client_chat: true } as any)
        .select('id').single();
      if (!convError && newConv) {
        await supabase.from('conversation_participants').insert([
          { conversation_id: newConv.id, user_id: user.id, role: 'owner' },
          { conversation_id: newConv.id, user_id: clientUserId, role: 'member' },
        ] as any);
      }

      // Send notification
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).single();
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
    onError: (err: any) => toast.error(err.message || 'Failed to invite client'),
  });

  // Generate share link for external client
  const generateLink = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const token = crypto.randomUUID();
      const { error } = await (supabase.from('project_clients') as any).insert({
        project_id: projectId,
        invited_by: user.id,
        status: 'invited',
        client_token: token,
        client_name: clientName.trim() || null,
        client_email: clientEmail.trim() || null,
      });
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: ['project-clients', projectId] });
      const link = `${window.location.origin}/client/${token}`;
      setGeneratedLink(link);
      toast.success('Client link generated!');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to generate link'),
  });

  const removeClient = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await (supabase.from('project_clients') as any).update({ status: 'removed' }).eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-clients', projectId] });
      toast.success('Client removed');
    },
  });

  const clientUserIds = clients.filter(c => c.client_user_id).map(c => c.client_user_id);
  const filteredResults = searchResults.filter(u => u.user_id !== user?.id && !clientUserIds.includes(u.user_id));

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Link copied!');
    } catch {
      window.prompt('Copy this link:', generatedLink);
    }
  };

  const handleSMS = () => {
    if (!generatedLink) return;
    const body = `You've been invited to view the project "${projectTitle}". View details here: ${generatedLink}`;
    window.open(`sms:?body=${encodeURIComponent(body)}`, '_blank');
  };

  const handleEmail = () => {
    if (!generatedLink) return;
    const subject = `Project Details: ${projectTitle}`;
    const body = `You've been invited to view the project "${projectTitle}".\n\nView all project details, add to calendar, and download a PDF breakdown here:\n${generatedLink}`;
    window.open(`mailto:${clientEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const handleSystemShare = async () => {
    if (!generatedLink) return;
    try {
      await navigator.share({ title: `Project: ${projectTitle}`, text: `View project details for "${projectTitle}"`, url: generatedLink });
    } catch {
      handleCopyLink();
    }
  };

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
            Invite clients or share a link for external access.
          </p>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1"><Link className="h-3.5 w-3.5 mr-1.5" /> Share Link</TabsTrigger>
            <TabsTrigger value="search" className="flex-1"><Search className="h-3.5 w-3.5 mr-1.5" /> Invite User</TabsTrigger>
          </TabsList>

          {/* Share Link Tab */}
          <TabsContent value="link" className="space-y-4">
            {!generatedLink ? (
              <>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client name (optional)" />
                <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Client email (optional)" type="email" />
                <Button className="w-full" onClick={() => generateLink.mutate()} disabled={generateLink.isPending}>
                  <Link className="h-4 w-4 mr-2" /> Generate Client Link
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
                  <Input value={generatedLink} readOnly className="text-xs bg-transparent border-0 p-0 h-auto focus-visible:ring-0" />
                  <Button size="sm" variant="ghost" onClick={handleCopyLink}>
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={handleSMS}>
                    <MessageCircle className="h-4 w-4 mr-1.5" /> SMS
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleEmail}>
                    <Mail className="h-4 w-4 mr-1.5" /> Email
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4 mr-1.5" /> Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSystemShare}>
                    <Share2 className="h-4 w-4 mr-1.5" /> Share
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => { setGeneratedLink(null); setClientName(''); setClientEmail(''); }}>
                  Generate Another Link
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search users to invite..." className="pl-9" />
            </div>
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
                      <Button size="sm" variant="outline" onClick={() => inviteClient.mutate(u.user_id)} disabled={inviteClient.isPending}>
                        <Send className="h-3 w-3 mr-1" /> Invite
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Current clients */}
        {clients.filter(c => c.status !== 'removed').length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <h4 className="text-sm font-medium text-muted-foreground">Current Clients</h4>
            {clients.filter(c => c.status !== 'removed').map(c => (
              <div key={c.id} className="flex items-center justify-between p-2 border border-border rounded-lg">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={c.profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {(c.profile?.display_name || c.client_name || '?')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{c.profile?.display_name || c.client_name || 'External Client'}</p>
                    <div className="flex items-center gap-1">
                      {statusBadge(c.status)}
                      {c.client_token && <Badge variant="outline" className="text-[10px]">Link</Badge>}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeClient.mutate(c.id)}>
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
