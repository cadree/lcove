import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Plus, Users, Coins, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useChallenges } from '@/hooks/useChallenges';
import { useState } from 'react';
import { CreateChallengeDialog } from '@/components/challenges/CreateChallengeDialog';
import { useAuth } from '@/contexts/AuthContext';

export default function Challenges() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useChallenges();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h1 className="font-display text-lg">Challenges</h1>
        {user ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create
          </Button>
        ) : <div className="w-16" />}
      </div>

      <div className="p-5 space-y-3 max-w-2xl mx-auto">
        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {!isLoading && !data?.length && (
          <Card className="p-8 text-center">
            <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No active challenges yet</p>
            <p className="text-sm text-muted-foreground mb-4">Be the first to launch one.</p>
            {user && <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> Create challenge</Button>}
          </Card>
        )}
        {data?.map((c) => (
          <Link key={c.id} to={`/challenge/${c.id}`}>
            <Card className="p-4 hover:bg-accent/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{c.title}</h3>
                  {c.description && <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                    {c.reward_credits > 0 && <span className="flex items-center gap-1 text-primary"><Coins className="w-3 h-3" />{c.reward_credits}</span>}
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.participant_count}</span>
                    {c.deadline && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(c.deadline).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <CreateChallengeDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
