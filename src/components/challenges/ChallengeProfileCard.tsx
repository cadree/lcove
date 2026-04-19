import { Link } from 'react-router-dom';
import { Trophy, Calendar, Users, Coins } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useChallengesByCreator } from '@/hooks/useChallenges';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { CreateChallengeDialog } from './CreateChallengeDialog';

interface Props {
  creatorId: string;
  isOwnProfile: boolean;
}

export function ChallengeProfileCard({ creatorId, isOwnProfile }: Props) {
  const { data: challenges } = useChallengesByCreator(creatorId, isOwnProfile);
  const [createOpen, setCreateOpen] = useState(false);
  const active = challenges?.find((c) => c.is_published && c.is_active);

  if (!active) {
    if (!isOwnProfile) return null;
    return (
      <>
        <Card className="p-4 mx-5 mt-4 border-dashed bg-card/50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Launch a Fan Challenge</p>
                <p className="text-xs text-muted-foreground">Reward your community with credits</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>Create</Button>
          </div>
        </Card>
        <CreateChallengeDialog open={createOpen} onOpenChange={setCreateOpen} />
      </>
    );
  }

  const deadlinePast = active.deadline ? new Date(active.deadline) < new Date() : false;

  return (
    <Link to={`/challenge/${active.id}`} className="block mx-5 mt-4">
      <Card className="p-4 hover:bg-accent/30 transition-colors cursor-pointer overflow-hidden relative">
        {active.cover_image_url && (
          <div
            className="absolute inset-0 opacity-20 bg-cover bg-center"
            style={{ backgroundImage: `url(${active.cover_image_url})` }}
          />
        )}
        <div className="relative">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Fan Challenge</p>
                <h3 className="font-semibold truncate">{active.title}</h3>
              </div>
            </div>
            {deadlinePast && <Badge variant="secondary">Closed</Badge>}
          </div>
          {active.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{active.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {active.reward_credits > 0 && (
              <span className="flex items-center gap-1 text-primary font-medium">
                <Coins className="w-3.5 h-3.5" /> {active.reward_credits} credits
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {active.participant_count}
            </span>
            {active.deadline && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {new Date(active.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
