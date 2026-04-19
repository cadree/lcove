import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useChallengeSubmissions, useReviewSubmission } from '@/hooks/useChallengeParticipation';
import { ExternalLink } from 'lucide-react';

export function ChallengeSubmissionsPanel({ challengeId }: { challengeId: string }) {
  const { data: subs, isLoading } = useChallengeSubmissions(challengeId);
  const review = useReviewSubmission();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading submissions…</p>;
  if (!subs?.length) return <p className="text-sm text-muted-foreground">No submissions yet.</p>;

  return (
    <div className="space-y-3">
      {subs.map((s) => (
        <Card key={s.id} className="p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="text-xs text-muted-foreground">
              {new Date(s.submitted_at).toLocaleString()}
            </div>
            <Badge variant={s.status === 'rewarded' || s.status === 'approved' ? 'default' : 'secondary'}>
              {s.status}
            </Badge>
          </div>
          {s.submission_text && <p className="text-sm mb-2">{s.submission_text}</p>}
          {s.submission_url && (
            <a href={s.submission_url} target="_blank" rel="noreferrer" className="text-sm text-primary inline-flex items-center gap-1 mb-3">
              View entry <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: s.id, status: 'approved' })}>
              Approve
            </Button>
            <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: s.id, status: 'rewarded' })}>
              Mark rewarded
            </Button>
            <Button size="sm" variant="ghost" disabled={review.isPending} onClick={() => review.mutate({ id: s.id, status: 'rejected' })}>
              Reject
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
