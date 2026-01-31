import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Users, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/hooks/useConversations';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (id: string) => void;
}

const NewChatDialog = ({ open, onOpenChange, onConversationCreated }: NewChatDialogProps) => {
  const { user } = useAuth();
  const { createDirectConversation, createGroupConversation } = useConversations();
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isGroup, setIsGroup] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users', search],
    queryFn: async () => {
      if (!user) return [];

      // Use profiles_public view to protect sensitive fields
      let query = supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .neq('user_id', user.id)
        .limit(20);

      if (search) {
        query = query.ilike('display_name', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!user,
  });

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (selectedUsers.length === 0) return;

    try {
      if (selectedUsers.length === 1 && !isGroup) {
        const conv = await createDirectConversation.mutateAsync(selectedUsers[0]);
        onConversationCreated(conv.id);
      } else {
        const conv = await createGroupConversation.mutateAsync({
          name: groupName || 'New Group',
          participantIds: selectedUsers,
        });
        onConversationCreated(conv.id);
      }
      onOpenChange(false);
      setSelectedUsers([]);
      setGroupName('');
      setIsGroup(false);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isGroup ? 'New Group Chat' : 'New Message'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle between DM and Group */}
          <div className="flex gap-2">
            <Button
              variant={!isGroup ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => {
                setIsGroup(false);
                if (selectedUsers.length > 1) {
                  setSelectedUsers([]);
                }
              }}
            >
              Direct Message
            </Button>
            <Button
              variant={isGroup ? 'default' : 'outline'}
              size="sm"
              className="flex-1 gap-2"
              onClick={() => setIsGroup(true)}
            >
              <Users className="w-4 h-4" />
              Group Chat
            </Button>
          </div>

          {/* Group Name Input */}
          {isGroup && (
            <Input
              placeholder="Group name (required)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-muted/30 border-border/50"
            />
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted/30 border-border/50"
            />
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map(userId => {
                const selectedUser = users.find(u => u.user_id === userId);
                return (
                  <motion.div
                    key={userId}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 text-primary text-sm"
                  >
                    <span>{selectedUser?.display_name || 'User'}</span>
                    <button onClick={() => toggleUser(userId)}>
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Helper text for group */}
          {isGroup && selectedUsers.length < 2 && (
            <p className="text-xs text-muted-foreground">
              Select at least 2 people to create a group chat
            </p>
          )}

          {/* User List */}
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {search ? 'No users found' : 'No users available'}
              </div>
            ) : (
              users.map(u => (
                <button
                  key={u.user_id}
                  onClick={() => {
                    if (!isGroup && selectedUsers.length === 1 && !selectedUsers.includes(u.user_id)) {
                      // For DM, replace selection
                      setSelectedUsers([u.user_id]);
                    } else {
                      toggleUser(u.user_id);
                    }
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    selectedUsers.includes(u.user_id)
                      ? 'bg-primary/10'
                      : 'hover:bg-accent/30'
                  }`}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      {u.display_name?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-left font-medium text-foreground">
                    {u.display_name || 'User'}
                  </span>
                  {selectedUsers.includes(u.user_id) && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreate}
              disabled={
                selectedUsers.length === 0 || 
                (isGroup && (selectedUsers.length < 2 || !groupName.trim())) ||
                createDirectConversation.isPending || 
                createGroupConversation.isPending
              }
            >
              {isGroup ? 'Create Group' : 'Start Chat'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;
