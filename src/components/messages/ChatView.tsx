import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { 
  ArrowLeft, MoreVertical, Phone, Video, Trash2, 
  Check, CheckCheck, Play, Pause, Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import { useConversations } from '@/hooks/useConversations';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import MessageComposer from './MessageComposer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatViewProps {
  conversationId: string;
  onBack: () => void;
}

const ChatView = ({ conversationId, onBack }: ChatViewProps) => {
  const { user } = useAuth();
  const { conversations } = useConversations();
  const { 
    messages, 
    isLoading, 
    sendMessage, 
    deleteMessage, 
    markAsRead,
    setTypingIndicator,
    typingUsers 
  } = useMessages(conversationId);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const conversation = conversations.find(c => c.id === conversationId);

  const getConversationName = () => {
    if (!conversation) return 'Chat';
    if (conversation.type === 'group') return conversation.name || 'Group';
    const otherParticipant = conversation.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.profile?.display_name || 'User';
  };

  const getConversationAvatar = () => {
    if (!conversation) return null;
    if (conversation.type === 'group') return conversation.avatar_url;
    const otherParticipant = conversation.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.profile?.avatar_url;
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when viewing
  useEffect(() => {
    markAsRead();
  }, [markAsRead, messages]);

  const formatMessageTime = (date: Date) => {
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return 'Yesterday ' + format(date, 'h:mm a');
    return format(date, 'MMM d, h:mm a');
  };

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: typeof messages }[] = [];
    let currentDate = '';

    messages.forEach(msg => {
      const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const handleSend = async (content?: string, file?: File, mediaType?: 'image' | 'video' | 'audio') => {
    await sendMessage.mutateAsync({ content, file, mediaType });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <Avatar className="w-10 h-10 border-2 border-border/50">
          <AvatarImage src={getConversationAvatar() || undefined} />
          <AvatarFallback className="bg-muted text-muted-foreground">
            {getConversationName().charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{getConversationName()}</h3>
          {typingUsers.length > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-primary"
            >
              {typingUsers.map(t => t.profile?.display_name || 'Someone').join(', ')} typing...
            </motion.p>
          )}
        </div>

        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Phone className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Video className="w-5 h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border">
              <DropdownMenuItem>View profile</DropdownMenuItem>
              <DropdownMenuItem>Mute notifications</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Block user</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-center">
            <div>
              <p className="text-lg mb-2">No messages yet</p>
              <p className="text-sm">Send a message to start the conversation</p>
            </div>
          </div>
        ) : (
          groupMessagesByDate().map(group => (
            <div key={group.date}>
              {/* Date Header */}
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground">
                  {formatDateHeader(group.date)}
                </span>
              </div>

              {/* Messages */}
              <AnimatePresence>
                {group.messages.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  const isRead = msg.read_by && msg.read_by.length > 0;

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-2 max-w-[80%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                        {!isOwn && (
                          <Avatar className="w-8 h-8 shrink-0">
                            <AvatarImage src={msg.profile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                              {msg.profile?.display_name?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div className={`group ${isOwn ? 'items-end' : 'items-start'}`}>
                          {/* Media */}
                          {msg.media_url && (
                            <div className="mb-1 rounded-xl overflow-hidden">
                              {msg.media_type === 'image' && (
                                <img
                                  src={msg.media_url}
                                  alt=""
                                  className="max-w-[250px] max-h-[300px] object-cover rounded-xl"
                                />
                              )}
                              {msg.media_type === 'video' && (
                                <video
                                  src={msg.media_url}
                                  controls
                                  className="max-w-[250px] max-h-[300px] rounded-xl"
                                />
                              )}
                              {msg.media_type === 'audio' && (
                                <audio src={msg.media_url} controls className="max-w-[250px]" />
                              )}
                            </div>
                          )}

                          {/* Text Content */}
                          {msg.content && (
                            <div
                              className={`px-4 py-2 rounded-2xl ${
                                isOwn
                                  ? 'bg-primary text-primary-foreground rounded-br-md'
                                  : 'bg-muted/60 text-foreground rounded-bl-md'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>
                          )}

                          {/* Time & Read Receipt */}
                          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                            <span className="text-[10px] text-muted-foreground">
                              {formatMessageTime(new Date(msg.created_at))}
                            </span>
                            {isOwn && (
                              <span className="text-muted-foreground">
                                {isRead ? (
                                  <CheckCheck className="w-3 h-3 text-primary" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                              </span>
                            )}
                          </div>

                          {/* Delete option for own messages */}
                          {isOwn && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMessage.mutate(msg.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ))
        )}

        {/* Typing Indicator */}
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex gap-2"
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={typingUsers[0]?.profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  {typingUsers[0]?.profile?.display_name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="px-4 py-3 rounded-2xl bg-muted/60 rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <MessageComposer 
        onSend={handleSend} 
        onTyping={setTypingIndicator}
        isSending={sendMessage.isPending}
      />
    </div>
  );
};

export default ChatView;
