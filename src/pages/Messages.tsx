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
        <div className="h-[calc(100vh-120px)] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center glass-strong rounded-2xl p-8 max-w-sm"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-medium text-foreground mb-2">
              Sign in to message
            </h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Connect with other creatives through direct messages
            </p>
            <Link to="/auth">
              <Button className="w-full">Sign In</Button>
            </Link>
          </motion.div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout hideNav={!!selectedConversation}>
      <div className="h-[calc(100vh-80px)] md:h-[calc(100vh-40px)] flex">
        {/* Conversation List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className={`w-full md:w-80 lg:w-96 border-r border-border/30 bg-card/20 backdrop-blur-sm ${
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
            <div className="flex-1 flex items-center justify-center bg-background/50">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center"
              >
                <div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-5">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/40" />
                </div>
                <h3 className="font-display text-xl text-foreground mb-2">Your Messages</h3>
                <p className="text-muted-foreground text-sm mb-5 max-w-xs">
                  Select a conversation or start a new one
                </p>
                <Button onClick={() => setShowNewChat(true)}>
                  New Message
                </Button>
              </motion.div>
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
