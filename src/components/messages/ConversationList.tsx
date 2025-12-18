import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Search, Plus, Users, MoreVertical, BellOff, Bell, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/hooks/useConversations';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

const ConversationList = ({ selectedId, onSelect, onNewChat }: ConversationListProps) => {
  const { user } = useAuth();
  const { conversations, isLoading, toggleMute } = useConversations();
  const [search, setSearch] = useState('');

  const getConversationName = (conv: typeof conversations[0]) => {
    if (conv.type === 'group') return conv.name || 'Group';
    const otherParticipant = conv.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.profile?.display_name || 'User';
  };

  const getConversationAvatar = (conv: typeof conversations[0]) => {
    if (conv.type === 'group') return conv.avatar_url;
    const otherParticipant = conv.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.profile?.avatar_url;
  };

  const getLastMessagePreview = (conv: typeof conversations[0]) => {
    if (!conv.last_message) return 'No messages yet';
    if (conv.last_message.media_type === 'image') return '📷 Photo';
    if (conv.last_message.media_type === 'video') return '🎥 Video';
    if (conv.last_message.media_type === 'audio') return '🎵 Audio';
    return conv.last_message.content || 'Message';
  };

  const filteredConversations = conversations.filter(conv => {
    const name = getConversationName(conv).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Please sign in to view messages
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-medium text-foreground">Messages</h2>
          <Button variant="glass" size="icon" onClick={onNewChat}>
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-muted/30 border-border/50"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center py-12 px-4 text-center glass-strong rounded-2xl"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5"
              >
                <MessageSquare className="w-8 h-8 text-primary/60" />
              </motion.div>
              <h3 className="font-display text-lg font-medium text-foreground mb-2">
                {search ? 'No conversations found' : 'Your conversations start here'}
              </h3>
              <p className="text-muted-foreground text-sm max-w-[200px] mb-5">
                {search 
                  ? 'Try a different search term' 
                  : 'Reach out to someone you want to collaborate with or just say hello.'}
              </p>
              {!search && (
                <Button onClick={onNewChat} size="sm">
                  Start a Conversation
                </Button>
              )}
            </motion.div>
          </div>
        ) : (
          <AnimatePresence>
            {filteredConversations.map((conv) => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => onSelect(conv.id)}
                className={`w-full flex items-center gap-3 p-4 hover:bg-accent/30 transition-colors text-left ${
                  selectedId === conv.id ? 'bg-accent/40' : ''
                }`}
              >
                <div className="relative">
                  <Avatar className="w-12 h-12 border-2 border-border/50">
                    <AvatarImage src={getConversationAvatar(conv) || undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      {conv.type === 'group' ? (
                        <Users className="w-5 h-5" />
                      ) : (
                        getConversationName(conv).charAt(0).toUpperCase()
                      )}
                    </AvatarFallback>
                  </Avatar>
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center font-medium">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`font-medium text-sm truncate ${
                      conv.unread_count > 0 ? 'text-foreground' : 'text-foreground/80'
                    }`}>
                      {getConversationName(conv)}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {conv.last_message?.created_at
                        ? formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: false })
                        : ''}
                    </span>
                  </div>
                  <p className={`text-xs truncate ${
                    conv.unread_count > 0 ? 'text-foreground/70 font-medium' : 'text-muted-foreground'
                  }`}>
                    {getLastMessagePreview(conv)}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="shrink-0 w-8 h-8 text-muted-foreground">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute.mutate({ conversationId: conv.id, muted: !(conv as any).is_muted });
                      }}
                    >
                      {(conv as any).is_muted ? (
                        <>
                          <Bell className="w-4 h-4 mr-2" />
                          Unmute
                        </>
                      ) : (
                        <>
                          <BellOff className="w-4 h-4 mr-2" />
                          Mute
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default ConversationList;
