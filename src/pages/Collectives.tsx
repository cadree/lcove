import { useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CollectiveCard } from "@/components/collectives/CollectiveCard";
import { CreateCollectiveDialog } from "@/components/collectives/CreateCollectiveDialog";
import {
  useCollectives,
  useMyCollectives,
  COLLECTIVE_TOPICS,
} from "@/hooks/useCollectives";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Plus, Users, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const topicLabels: Record<string, string> = {
  all: "All",
  models: "Models",
  dancers: "Dancers",
  djs: "DJs",
  filmmakers: "Filmmakers",
  photographers: "Photographers",
  musicians: "Musicians",
  travelers: "Travelers",
  writers: "Writers",
  artists: "Artists",
  general: "General",
};

export default function Collectives() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: collectives, isLoading } = useCollectives(selectedTopic);
  const { data: myCollectives, isLoading: myLoading } = useMyCollectives();

  const handleCreateClick = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setCreateDialogOpen(true);
  };

  return (
    <PageLayout>
      <div className="container max-w-2xl py-6 px-4">
        <h1 className="text-2xl font-display font-medium mb-6">Collectives</h1>
        
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mb-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-display font-medium mb-1">
                    Build Your Creative Tribe
                  </h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    Create and join collectives—sub-communities of creators who share
                    your passions. Collaborate, share, and grow together.
                  </p>
                  <Button onClick={handleCreateClick}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Collective
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Tabs defaultValue="discover" className="space-y-4">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="discover" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="my" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              My Collectives
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-4">
            {/* Topic Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <Badge
                variant={selectedTopic === "all" ? "default" : "secondary"}
                className="cursor-pointer shrink-0"
                onClick={() => setSelectedTopic("all")}
              >
                All
              </Badge>
              {COLLECTIVE_TOPICS.map((topic) => (
                <Badge
                  key={topic}
                  variant={selectedTopic === topic ? "default" : "secondary"}
                  className="cursor-pointer shrink-0"
                  onClick={() => setSelectedTopic(topic)}
                >
                  {topicLabels[topic]}
                </Badge>
              ))}
            </div>

            {/* Collectives List */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : collectives && collectives.length > 0 ? (
              <div className="space-y-3">
                {collectives.map((collective, index) => (
                  <motion.div
                    key={collective.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <CollectiveCard collective={collective} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No collectives found"
                description="Be the first to create a collective in this category!"
                action={{
                  label: "Create Collective",
                  onClick: handleCreateClick,
                }}
              />
            )}
          </TabsContent>

          <TabsContent value="my" className="space-y-4">
            {!user ? (
              <EmptyState
                icon={Users}
                title="Sign in to see your collectives"
                description="Create an account to join and create collectives"
                action={{
                  label: "Sign In",
                  onClick: () => navigate("/auth"),
                }}
              />
            ) : myLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : myCollectives && myCollectives.length > 0 ? (
              <div className="space-y-3">
                {myCollectives.map((collective, index) => (
                  <motion.div
                    key={collective.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <CollectiveCard collective={collective} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="No collectives yet"
                description="You haven't joined or created any collectives"
                action={{
                  label: "Create Your First Collective",
                  onClick: handleCreateClick,
                }}
              />
            )}
          </TabsContent>
        </Tabs>

        <CreateCollectiveDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </div>
    </PageLayout>
  );
}
