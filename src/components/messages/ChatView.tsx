import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { 
  ArrowLeft, MoreVertical, Phone, Video, Trash2, 
  Check, CheckCheck, Play, Pause, Image as ImageIcon,
  Users, Calendar, Info, ChevronDown, ChevronUp, LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import { useConversations } from '@/hooks/useConversations';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { usePresence } from '@/hooks/usePresence';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OnlineIndicator } from '@/components/ui/online-indicator';
import MessageComposer from './MessageComposer';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ChatViewProps {
  conversationId: string;
  onBack: () => void;
}

const ChatView = ({ conversationId, onBack }: ChatViewProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversations, toggleMute, leaveConversation } = useConversations();
  const { 
    messages, 
    isLoading, 
    sendMessage, 
    deleteMessage, 
    markAsRead,
    setTypingIndicator,
    typingUsers 
  } = useMessages(conversationId);
  const { blockUser } = useUserBlocks();
  const { isOnline } = usePresence();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [showProjectInfo, setShowProjectInfo] = useState(false);

  const conversation = conversations.find(c => c.id === conversationId);
  
  // Get the other participant's user ID for direct messages
  const getOtherUserId = () => {
    if (!conversation || conversation.type !== 'direct') return null;
    const otherParticipant = conversation.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.user_id || null;
  };
  
  const otherUserId = getOtherUserId();
  const isMuted = conversation?.participants?.find(p => p.user_id === user?.id)?.is_muted || false;
  const isProjectChat = !!(conversation as any)?.project_id;
  const project = (conversation as any)?.project;

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

  const getParticipantRole = (participant: any) => {
    return participant.project_role_name || null;
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
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="relative">
          <Avatar className="w-10 h-10 border-2 border-border/50">
            <AvatarImage src={getConversationAvatar() || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground">
              {getConversationName().charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Online indicator for direct messages */}
          {conversation?.type === 'direct' && otherUserId && (
            <OnlineIndicator 
              isOnline={isOnline(otherUserId)} 
              size="md"
              className="absolute bottom-0 right-0"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground truncate">{getConversationName()}</h3>
            {isProjectChat && (
              <Badge variant="secondary" className="text-xs">Project</Badge>
            )}
          </div>
          {typingUsers.length > 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-primary"
            >
              {typingUsers.map(t => t.profile?.display_name || 'Someone').join(', ')} typing...
            </motion.p>
          ) : conversation?.type === 'direct' && otherUserId ? (
            <p className="text-xs text-muted-foreground">
              {isOnline(otherUserId) ? 'Online' : 'Offline'}
            </p>
          ) : isProjectChat ? (
            <p className="text-xs text-muted-foreground">
              {conversation?.participants?.length || 0} team members
            </p>
          ) : null}
        </div>

        <div className="flex gap-1">
          {isProjectChat && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-primary"
              onClick={() => setShowProjectInfo(!showProjectInfo)}
            >
              <Info className="w-5 h-5" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-primary"
            onClick={() => {
              toast.info(`Calling ${getConversationName()}...`, {
                description: 'Voice calls are coming soon! Stay tuned for this feature.',
                duration: 3000,
              });
            }}
          >
            <Phone className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-primary"
            onClick={() => {
              toast.info(`Video calling ${getConversationName()}...`, {
                description: 'Video calls are coming soon! Stay tuned for this feature.',
                duration: 3000,
              });
            }}
          >
            <Video className="w-5 h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border">
              {otherUserId && conversation?.type === 'direct' && (
                <DropdownMenuItem onClick={() => navigate(`/profile/${otherUserId}`)}>
                  View profile
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={() => {
                  toggleMute.mutate({ conversationId, muted: !isMuted });
                  toast.success(isMuted ? 'Notifications unmuted' : 'Notifications muted');
                }}
              >
                {isMuted ? 'Unmute notifications' : 'Mute notifications'}
              </DropdownMenuItem>
              {conversation?.type === 'group' && (
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => {
                    leaveConversation.mutate(conversationId, {
                      onSuccess: () => {
                        onBack();
                      }
                    });
                  }}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave group
                </DropdownMenuItem>
              )}
              {otherUserId && conversation?.type === 'direct' && (
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => {
                    blockUser.mutate(otherUserId, {
                      onSuccess: () => {
                        onBack();
                      }
                    });
                  }}
                >
                  Block user
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Project Info Panel */}
      <AnimatePresence>
        {isProjectChat && showProjectInfo && project && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border/50 bg-muted/30 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Project Details */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  Project Details
                </h4>
                {project.description && (
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                )}
                {(project.timeline_start || project.timeline_end) && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {project.timeline_start && format(new Date(project.timeline_start), 'MMM d')}
                      {project.timeline_start && project.timeline_end && ' - '}
                      {project.timeline_end && format(new Date(project.timeline_end), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
              </div>

              {/* Team Members with Roles */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Team ({conversation?.participants?.length || 0})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {conversation?.participants?.map((participant) => (
                    <div key={participant.user_id} className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={participant.profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-muted">
                          {participant.profile?.display_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1 truncate">
                        {participant.profile?.display_name || 'Unknown'}
                      </span>
                      {getParticipantRole(participant) && (
                        <Badge variant="outline" className="text-xs">
                          {getParticipantRole(participant)}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  const senderParticipant = conversation?.participants?.find(p => p.user_id === msg.sender_id);
                  const senderRole = senderParticipant ? getParticipantRole(senderParticipant) : null;

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

                        <div className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                          {/* Sender name with role for group chats */}
                          {!isOwn && conversation?.type === 'group' && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-foreground">
                                {msg.profile?.display_name || 'Unknown'}
                              </span>
                              {senderRole && (
                                <Badge variant="outline" className="text-[10px] py-0 h-4">
                                  {senderRole}
                                </Badge>
                              )}
                            </div>
                          )}
                          
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

                          {/* Delete option for own messages - always visible on mobile */}
                          {isOwn && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMessage.mutate(msg.id)}
                              className="md:opacity-0 md:group-hover:opacity-100 transition-opacity w-6 h-6 text-muted-foreground hover:text-destructive active:text-destructive"
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
