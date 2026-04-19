import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Calendar, Users, Coins, Loader2, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useChallenge, useDeleteChallenge } from '@/hooks/useChallenges';
import { useMyParticipation, useMySubmission, useJoinChallenge } from '@/hooks/useChallengeParticipation';
import { ChallengeSubmissionsPanel } from '@/components/challenges/ChallengeSubmissionsPanel';
import { SubmitEntryDialog } from '@/components/challenges/SubmitEntryDialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function ChallengeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: challenge, isLoading } = useChallenge(id);
  const { data: participation } = useMyParticipation(id);
  const { data: submission } = useMySubmission(id);
  const join = useJoinChallenge();
  const del = useDeleteChallenge();
  const [submitOpen, setSubmitOpen] = useState(false);

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!challenge) return <div className="p-8 text-center text-muted-foreground">Challenge not found</div>;

  const isOwner = user?.id === challenge.creator_id;
  const deadlinePast = challenge.deadline ? new Date(challenge.deadline) < new Date() : false;
  const closed = !challenge.is_active || deadlinePast;

  const renderCTA = () => {
    if (!user) return <Button className="w-full" onClick={() => navigate('/auth')}>Sign in to join</Button>;
    if (isOwner) return null;
    if (closed) return <Button className="w-full" disabled>Challenge Closed</Button>;
    if (submission) return <Button className="w-full" disabled variant="secondary">Submitted ✓</Button>;
    if (participation) return <Button className="w-full" onClick={() => setSubmitOpen(true)}>Submit Entry</Button>;
    return (
      <Button
        className="w-full"
        disabled={join.isPending}
        onClick={() => {
          if (challenge.cost_credits > 0) {
            if (!confirm(`This costs ${challenge.cost_credits} credits to join. Continue?`)) return;
          }
          join.mutate(challenge.id);
        }}
      >
        {join.isPending ? 'Joining…' : challenge.cost_credits > 0 ? `Join for ${challenge.cost_credits} credits` : 'Join Challenge'}
      </Button>
    );
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/challenges'))}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (confirm('Delete this challenge?')) {
                await del.mutateAsync(challenge.id);
                navigate(-1);
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {challenge.cover_image_url && (
        <div
          className="h-48 bg-cover bg-center"
          style={{ backgroundImage: `url(${challenge.cover_image_url})` }}
        />
      )}

      <div className="px-5 py-6 space-y-6 max-w-2xl mx-auto">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
            <Trophy className="w-3.5 h-3.5" /> Fan Challenge
            {closed && <Badge variant="secondary" className="ml-auto">Closed</Badge>}
          </div>
          <h1 className="text-3xl font-display font-semibold mb-2">{challenge.title}</h1>
          {challenge.description && (
            <p className="text-muted-foreground whitespace-pre-wrap">{challenge.description}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <Coins className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-semibold">{challenge.reward_credits}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Reward</p>
          </Card>
          <Card className="p-3 text-center">
            <Users className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-semibold">{challenge.participant_count}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Joined</p>
          </Card>
          <Card className="p-3 text-center">
            <Calendar className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-semibold">{challenge.deadline ? new Date(challenge.deadline).toLocaleDateString() : '—'}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Deadline</p>
          </Card>
        </div>

        {challenge.rules && (
          <div>
            <h2 className="font-semibold mb-2">Rules</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{challenge.rules}</p>
          </div>
        )}

        <div>{renderCTA()}</div>

        {isOwner && (
          <>
            <Separator />
            <div>
              <h2 className="font-semibold mb-3">Submissions</h2>
              <ChallengeSubmissionsPanel challengeId={challenge.id} />
            </div>
          </>
        )}
      </div>

      <SubmitEntryDialog open={submitOpen} onOpenChange={setSubmitOpen} challengeId={challenge.id} />
    </div>
  );
}
