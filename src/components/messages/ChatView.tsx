import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { calendarDayKey, dayDividerLabel, localCalendarDayDelta } from '@/lib/calendarDay';
import { 
  ArrowLeft, MoreVertical, Trash2, 
  Check, CheckCheck, Play, Pause, Image as ImageIcon,
  Users, Calendar, Info, ChevronDown, ChevronUp, LogOut, Flag
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useMessages } from '@/hooks/useMessages';
import { useConversations } from '@/hooks/useConversations';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { usePresence } from '@/hooks/usePresence';
import { useProjectChatData } from '@/hooks/useProjectChatData';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OnlineIndicator } from '@/components/ui/online-indicator';
import MessageComposer from './MessageComposer';
import { CreateSubgroupDialog } from './CreateSubgroupDialog';
import ProjectCommandCenter from './ProjectCommandCenter';
import { toast } from 'sonner';
import { ReportDialog } from '@/components/safety/ReportDialog';
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
  
  const conversation = conversations.find(c => c.id === conversationId);
  const projectId = conversation?.project_id ?? null;
  const isProjectChat = !!projectId;
  const { data: projectChatData } = useProjectChatData(projectId);
  const isOwner = !!(projectChatData && user && projectChatData.creator_id === user.id);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const [reportMessageId, setReportMessageId] = useState<string | null>(null);
  const [reportProfileId, setReportProfileId] = useState<string | null>(null);
  const [subgroupOpen, setSubgroupOpen] = useState(false);
  const [selectingShare, setSelectingShare] = useState(false);
  const [shareIds, setShareIds] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const queryClient = useQueryClient();

  
  // Get the other participant's user ID for direct messages
  const getOtherUserId = () => {
    if (!conversation || conversation.type !== 'direct') return null;
    const otherParticipant = conversation.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.user_id || null;
  };
  
  const otherUserId = getOtherUserId();
  const isMuted = conversation?.participants?.find(p => p.user_id === user?.id)?.is_muted || false;
  const project = conversation?.project;
  const isParticipant = conversation?.participants?.some((participant) => participant.user_id === user?.id) ?? !conversation?.oversight;
  const isSubgroup = Boolean(conversation?.parent_conversation_id);

  const { data: subgroups = [] } = useQuery({
    queryKey: ['project-subgroups', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('conversations')
        .select('id, name, parent_conversation_id')
        .eq('project_id', projectId)
        .not('parent_conversation_id', 'is', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && !!isProjectChat,
  });

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

  const getParticipantRole = (participant: { project_role_name?: string | null }) => {
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
    const time = format(date, 'h:mm a');
    const delta = localCalendarDayDelta(date, new Date());
    if (delta === 0) return time;
    if (delta === -1) return `Yesterday ${time}`;
    return format(date, 'MMM d, h:mm a');
  };

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: typeof messages }[] = [];
    let currentDate = '';

    messages.forEach(msg => {
      const msgDate = calendarDayKey(msg.created_at);
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const handleSend = async (content?: string, file?: File, mediaType?: 'image' | 'video' | 'audio') => {
    await sendMessage.mutateAsync({ content, file, mediaType });
  };

  const toggleShare = (messageId: string) => {
    setShareIds((current) =>
      current.includes(messageId) ? current.filter((id) => id !== messageId) : [...current, messageId],
    );
  };

  const shareToMain = async () => {
    if (shareIds.length === 0) return;
    setSharing(true);
    try {
      const { error } = await supabase.rpc('share_messages_to_project_main', {
        p_message_ids: shareIds,
      });
      if (error) throw error;
      const mainId = conversation?.parent_conversation_id;
      if (mainId && user) {
        const { data: shared } = await supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', mainId)
          .eq('sender_id', user.id)
          .not('shared_from_message_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (shared) {
          supabase.functions.invoke('notify-chat-message', {
            body: { conversation_id: mainId, message_id: shared.id },
          }).catch(() => undefined);
        }
      }
      toast.success('Shared to the main project chat');
      setShareIds([]);
      setSelectingShare(false);
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not share those messages');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header */}
      <div className="tab-bar flex items-center gap-3 border-b border-border p-4">
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
            <h3 className="truncate font-body text-[15px] font-bold text-foreground">{getConversationName()}</h3>
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
              {(() => {
                const participants = conversation?.participants || [];
                const onlineCount = participants.filter(p => isOnline(p.user_id)).length;
                return `${onlineCount} of ${participants.length} online`;
              })()}
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
              {isParticipant && (
                <DropdownMenuItem 
                  onClick={() => {
                    toggleMute.mutate({ conversationId, muted: !isMuted });
                    toast.success(isMuted ? 'Notifications unmuted' : 'Notifications muted');
                  }}
                >
                  {isMuted ? 'Unmute notifications' : 'Mute notifications'}
                </DropdownMenuItem>
              )}
              {isProjectChat && isParticipant && !isSubgroup && (
                <DropdownMenuItem onClick={() => setSubgroupOpen(true)}>
                  New subgroup
                </DropdownMenuItem>
              )}
              {isSubgroup && isParticipant && (
                <DropdownMenuItem onClick={() => {
                  setSelectingShare((current) => !current);
                  setShareIds([]);
                }}>
                  {selectingShare ? 'Cancel share' : 'Share to main chat'}
                </DropdownMenuItem>
              )}
              {conversation?.type === 'group' && isParticipant && (
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
              {otherUserId && conversation?.type === 'direct' && (
                <DropdownMenuItem onClick={() => setReportProfileId(otherUserId)}>
                  <Flag className="w-4 h-4 mr-2" />
                  Report profile
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Presence Bar for Project Chats */}
      {isProjectChat && conversation?.participants && conversation.participants.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/30 bg-card/20 overflow-x-auto">
          {conversation.participants.map(p => (
            <div key={p.user_id} className="relative shrink-0">
              <Avatar className="w-7 h-7">
                <AvatarImage src={p.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-muted">
                  {p.profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <OnlineIndicator
                isOnline={isOnline(p.user_id)}
                size="sm"
                showOffline
                className="absolute -bottom-0.5 -right-0.5"
              />
            </div>
          ))}
        </div>
      )}

      {/* Project Command Center */}
      {isProjectChat && projectChatData && (
        <ProjectCommandCenter project={projectChatData} isOwner={isOwner} />
      )}

      {isProjectChat && (subgroups.length > 0 || isSubgroup) && (
        <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2">
          {isSubgroup && conversation?.parent_conversation_id && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mono-label h-8 rounded-full border-border px-3 text-[10px]"
              onClick={() => navigate(`/messages?chat=${conversation.parent_conversation_id}`)}
            >
              Main chat
            </Button>
          )}
          {subgroups.map((subgroup) => (
            <Button
              key={subgroup.id}
              type="button"
              size="sm"
              variant={subgroup.id === conversationId ? 'default' : 'outline'}
              className="mono-label h-8 rounded-full px-3 text-[10px]"
              onClick={() => navigate(`/messages?chat=${subgroup.id}`)}
            >
              {subgroup.name || 'Subgroup'}
            </Button>
          ))}
        </div>
      )}

      {!isParticipant && isProjectChat && (
        <p className="mono-label border-b border-border px-4 py-2 text-[9px] text-muted-foreground">
          You can read this chat as the project owner.
        </p>
      )}

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
                <span className="mono-label rounded-full border border-border px-3 py-1 text-[9px] text-muted-foreground">
                  {dayDividerLabel(group.messages[0].created_at)}
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
                          {conversation?.type === 'group' && (senderRole || !isOwn) && (
                            <div className="flex items-center gap-2 mb-1">
                              {!isOwn && (
                                <span className="text-xs font-medium text-foreground">
                                  {msg.profile?.display_name || conversation?.participants?.find(p => p.user_id === msg.sender_id)?.profile?.display_name || 'Member'}
                                </span>
                              )}
                              {senderRole && (
                                <Badge variant="outline" className="mono-label h-4 border-border py-0 text-[9px]">
                                  {senderRole}
                                </Badge>
                              )}
                              {selectingShare && (
                                <input
                                  type="checkbox"
                                  checked={shareIds.includes(msg.id)}
                                  onChange={() => toggleShare(msg.id)}
                                  aria-label="Share this message"
                                />
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
                              className={`px-4 py-2.5 ${
                                isOwn
                                  ? 'rounded-[18px] rounded-br-[6px] bg-gradient-to-br from-[#FFD6E8] to-[#FF9FC8] text-[#0A0A0A]'
                                  : 'file-panel rounded-[18px] rounded-bl-[6px] px-4 py-2.5 text-foreground'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>
                          )}

                          {/* Time & Read Receipt */}
                          <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                            <span className="mono-label text-[9px] text-muted-foreground">
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
                            {!isOwn && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-6 h-6 text-muted-foreground"
                                aria-label="Report message"
                                onClick={() => setReportMessageId(msg.id)}
                              >
                                <Flag className="w-3 h-3" />
                              </Button>
                            )}
                          </div>

                          {/* Delete option - always visible on mobile */}
                          {isOwn && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMessage.mutate(msg.id)}
                              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity w-6 h-6 text-muted-foreground hover:text-destructive active:text-destructive"
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
              <div className="file-panel rounded-[18px] rounded-bl-[6px] px-4 py-3">
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

      {selectingShare && (
        <div className="tab-bar flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="mono-label text-[10px] text-muted-foreground">{shareIds.length} selected</span>
          <Button type="button" size="sm" className="rounded-[14px]" onClick={shareToMain} disabled={sharing || shareIds.length === 0}>
            {sharing ? 'Sharing...' : 'Share to main chat'}
          </Button>
        </div>
      )}

      {isParticipant ? (
        <MessageComposer 
          onSend={handleSend} 
          onTyping={setTypingIndicator}
          isSending={sendMessage.isPending}
        />
      ) : null}
      {projectId && !isSubgroup && (
        <CreateSubgroupDialog
          open={subgroupOpen}
          onOpenChange={setSubgroupOpen}
          projectId={projectId}
          mainConversationId={conversationId}
          members={conversation?.participants || []}
          onCreated={(id) => navigate(`/messages?chat=${id}`)}
        />
      )}
      {reportMessageId && (
        <ReportDialog
          open
          onOpenChange={(open) => {
            if (!open) setReportMessageId(null);
          }}
          targetType="message"
          targetId={reportMessageId}
        />
      )}
      {reportProfileId && (
        <ReportDialog
          open
          onOpenChange={(open) => {
            if (!open) setReportProfileId(null);
          }}
          targetType="profile"
          targetId={reportProfileId}
        />
      )}
    </div>
  );
};

export default ChatView;
