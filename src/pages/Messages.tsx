import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import ConversationList from '@/components/messages/ConversationList';
import ChatView from '@/components/messages/ChatView';
import NewChatDialog from '@/components/messages/NewChatDialog';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Messages = () => {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);

  if (!user) {
    return (
      <PageLayout>
        <div className="h-[calc(100vh-120px)] flex items-center justify-center">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="font-display text-2xl font-medium text-foreground mb-2">
              Sign in to message
            </h2>
            <p className="text-muted-foreground mb-6">
              Connect with other creatives through direct messages
            </p>
            <Link to="/auth">
              <Button>Sign In</Button>
            </Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout hideNav={!!selectedConversation}>
      <div className="h-[calc(100vh-80px)] md:h-[calc(100vh-40px)] flex">
        {/* Conversation List - Hidden on mobile when chat is open */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`w-full md:w-80 lg:w-96 border-r border-border/50 bg-card/30 ${
            selectedConversation ? 'hidden md:block' : 'block'
          }`}
        >
          <ConversationList
            selectedId={selectedConversation}
            onSelect={setSelectedConversation}
            onNewChat={() => setShowNewChat(true)}
          />
        </motion.div>

        {/* Chat View */}
        <div className={`flex-1 ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
          {selectedConversation ? (
            <ChatView
              conversationId={selectedConversation}
              onBack={() => setSelectedConversation(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-background">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="font-display text-xl text-foreground mb-2">Your Messages</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Select a conversation or start a new one
                </p>
                <Button onClick={() => setShowNewChat(true)}>
                  New Message
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* New Chat Dialog */}
        <NewChatDialog
          open={showNewChat}
          onOpenChange={setShowNewChat}
          onConversationCreated={(id) => {
            setSelectedConversation(id);
            setShowNewChat(false);
          }}
        />
      </div>
    </PageLayout>
  );
};

export default Messages;
