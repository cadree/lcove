import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Lock, Globe, Eye } from "lucide-react";
import { Collective, useJoinCollective, useMyCollectives } from "@/hooks/useCollectives";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface CollectiveCardProps {
  collective: Collective;
}

const topicLabels: Record<string, string> = {
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

export function CollectiveCard({ collective }: CollectiveCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: myCollectives } = useMyCollectives();
  const joinMutation = useJoinCollective();

  const isMember = myCollectives?.some((c) => c.id === collective.id);
  const isOwner = collective.created_by === user?.id;

  const handleJoin = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    joinMutation.mutate(collective.id);
  };

  const handleOpen = () => {
    navigate(`/messages?conversation=${collective.id}`);
  };

  const VisibilityIcon =
    collective.visibility === "public"
      ? Globe
      : collective.visibility === "discoverable"
      ? Eye
      : Lock;

  return (
    <Card className="card-premium hover:border-primary/30 transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 rounded-xl">
            <AvatarImage src={collective.avatar_url || undefined} />
            <AvatarFallback className="rounded-xl bg-primary/10 text-primary">
              {collective.name?.charAt(0) || "C"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{collective.name}</h3>
              <VisibilityIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>

            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                {topicLabels[collective.collective_topic || "general"]}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {collective.member_count || 0} members
              </span>
            </div>

            {collective.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {collective.description}
              </p>
            )}
          </div>

          <div className="shrink-0">
            {isMember || isOwner ? (
              <Button size="sm" variant="outline" onClick={handleOpen}>
                Open
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleJoin}
                disabled={joinMutation.isPending}
              >
                {collective.visibility === "discoverable" ? "Request" : "Join"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
