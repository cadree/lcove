import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Check,
  X,
  Eye,
  Film,
  Clock,
  User,
  Image,
  Inbox,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Submission {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  director: string | null;
  cast_members: string[] | null;
  runtime_minutes: number | null;
  pitch_notes: string | null;
  cover_art_url: string | null;
  trailer_url: string | null;
  video_url: string | null;
  external_video_url: string | null;
  credits: { moodboard?: string[] } | null;
  status: string;
  created_at: string;
  submitter_id: string;
  rejection_reason: string | null;
  submitter?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface SubmissionsPanelProps {
  networkId: string;
}

export const SubmissionsPanel = ({ networkId }: SubmissionsPanelProps) => {
  const queryClient = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['content-submissions', networkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_submissions')
        .select('*')
        .eq('network_id', networkId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch submitter profiles
      const submitterIds = [...new Set((data || []).map(s => s.submitter_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', submitterIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      return (data || []).map(submission => ({
        ...submission,
        submitter: profileMap.get(submission.submitter_id) || null,
      })) as Submission[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (submission: Submission) => {
      // First, create the network content
      const { data: contentData, error: contentError } = await supabase
        .from('network_content')
        .insert({
          network_id: networkId,
          creator_id: submission.submitter_id,
          title: submission.title,
          description: submission.description,
          content_type: submission.content_type as any,
          director: submission.director,
          cast_members: submission.cast_members,
          runtime_minutes: submission.runtime_minutes,
          cover_art_url: submission.cover_art_url,
          trailer_url: submission.trailer_url,
          video_url: submission.video_url,
          external_video_url: submission.external_video_url,
          credits: submission.credits || {},
          is_published: false, // Start as draft so owner can review
          is_featured: false,
        })
        .select()
        .single();

      if (contentError) throw contentError;

      // Update submission status
      const { data: session } = await supabase.auth.getSession();
      const { error: updateError } = await supabase
        .from('content_submissions')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.session?.user?.id,
        })
        .eq('id', submission.id);

      if (updateError) throw updateError;

      return contentData;
    },
    onSuccess: () => {
      toast.success('Submission approved and added to network!');
      queryClient.invalidateQueries({ queryKey: ['content-submissions', networkId] });
      queryClient.invalidateQueries({ queryKey: ['network-content-manage', networkId] });
      setSelectedSubmission(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ submissionId, reason }: { submissionId: string; reason: string }) => {
      const { data: session } = await supabase.auth.getSession();
      const { error } = await supabase
        .from('content_submissions')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.session?.user?.id,
        })
        .eq('id', submissionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Submission rejected');
      queryClient.invalidateQueries({ queryKey: ['content-submissions', networkId] });
      setShowRejectDialog(false);
      setSelectedSubmission(null);
      setRejectionReason('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const pendingSubmissions = submissions.filter(s => s.status === 'pending');
  const reviewedSubmissions = submissions.filter(s => s.status !== 'pending');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-16 bg-muted/30 rounded-xl">
        <Inbox className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium mb-2">No submissions yet</h3>
        <p className="text-muted-foreground">
          When creators submit content to your network, it will appear here for review
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Submissions */}
      {pendingSubmissions.length > 0 && (
        <div>
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Pending Review ({pendingSubmissions.length})
          </h3>
          <div className="grid gap-4">
            {pendingSubmissions.map((submission) => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                onView={() => setSelectedSubmission(submission)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reviewed Submissions */}
      {reviewedSubmissions.length > 0 && (
        <div>
          <h3 className="font-semibold mb-4">Previously Reviewed</h3>
          <div className="grid gap-4">
            {reviewedSubmissions.map((submission) => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                onView={() => setSelectedSubmission(submission)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Submission Detail Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Film className="w-5 h-5" />
                  {selectedSubmission.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Cover & Basic Info */}
                <div className="flex gap-4">
                  {selectedSubmission.cover_art_url ? (
                    <img
                      src={selectedSubmission.cover_art_url}
                      alt=""
                      className="w-32 h-48 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-32 h-48 rounded-lg bg-muted flex items-center justify-center">
                      <Film className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">
                        {selectedSubmission.content_type.replace('_', ' ')}
                      </Badge>
                      <Badge variant={
                        selectedSubmission.status === 'approved' ? 'default' :
                        selectedSubmission.status === 'rejected' ? 'destructive' : 'secondary'
                      }>
                        {selectedSubmission.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-2">
                      {selectedSubmission.description}
                    </p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {selectedSubmission.submitter && (
                        <p className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Submitted by: {selectedSubmission.submitter.display_name || 'Unknown'}
                        </p>
                      )}
                      {selectedSubmission.director && (
                        <p>Director: {selectedSubmission.director}</p>
                      )}
                      {selectedSubmission.runtime_minutes && (
                        <p>Runtime: {selectedSubmission.runtime_minutes} minutes</p>
                      )}
                      <p>Submitted: {format(new Date(selectedSubmission.created_at), 'PPP')}</p>
                    </div>
                  </div>
                </div>

                {/* Cast */}
                {selectedSubmission.cast_members && selectedSubmission.cast_members.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Cast
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedSubmission.cast_members.map((member, i) => (
                        <Badge key={i} variant="outline">{member}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Moodboard */}
                {selectedSubmission.credits?.moodboard && selectedSubmission.credits.moodboard.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      Moodboard
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedSubmission.credits.moodboard.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Moodboard ${i + 1}`}
                          className="aspect-video rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Pitch Notes */}
                {selectedSubmission.pitch_notes && (
                  <div>
                    <h4 className="font-medium mb-2">Pitch Notes</h4>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="whitespace-pre-wrap">{selectedSubmission.pitch_notes}</p>
                    </div>
                  </div>
                )}

                {/* Preview Links */}
                <div className="flex flex-wrap gap-2">
                  {selectedSubmission.trailer_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedSubmission.trailer_url} target="_blank" rel="noopener noreferrer">
                        Watch Trailer
                      </a>
                    </Button>
                  )}
                  {(selectedSubmission.video_url || selectedSubmission.external_video_url) && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={selectedSubmission.video_url || selectedSubmission.external_video_url!} target="_blank" rel="noopener noreferrer">
                        Watch Full Video
                      </a>
                    </Button>
                  )}
                </div>

                {/* Rejection Reason */}
                {selectedSubmission.status === 'rejected' && selectedSubmission.rejection_reason && (
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <h4 className="font-medium text-destructive mb-1">Rejection Reason</h4>
                    <p className="text-sm">{selectedSubmission.rejection_reason}</p>
                  </div>
                )}

                {/* Action Buttons */}
                {selectedSubmission.status === 'pending' && (
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectDialog(true)}
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => approveMutation.mutate(selectedSubmission)}
                      disabled={approveMutation.isPending}
                      className="flex-1"
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejection. This will be visible to the submitter.
            </p>
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowRejectDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedSubmission) {
                    rejectMutation.mutate({
                      submissionId: selectedSubmission.id,
                      reason: rejectionReason,
                    });
                  }
                }}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                className="flex-1"
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Confirm Rejection'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Submission Card Component
const SubmissionCard = ({
  submission,
  onView,
}: {
  submission: Submission;
  onView: () => void;
}) => (
  <div
    className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border border-border hover:border-primary/50 transition-colors cursor-pointer"
    onClick={onView}
  >
    {submission.cover_art_url ? (
      <img
        src={submission.cover_art_url}
        alt=""
        className="w-16 h-24 rounded object-cover"
      />
    ) : (
      <div className="w-16 h-24 rounded bg-muted flex items-center justify-center">
        <Film className="w-6 h-6 text-muted-foreground" />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <h4 className="font-medium truncate">{submission.title}</h4>
      <p className="text-sm text-muted-foreground truncate">
        {submission.description}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <Badge variant="secondary" className="text-xs">
          {submission.content_type.replace('_', ' ')}
        </Badge>
        <Badge 
          variant={
            submission.status === 'approved' ? 'default' :
            submission.status === 'rejected' ? 'destructive' : 'secondary'
          }
          className="text-xs"
        >
          {submission.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {format(new Date(submission.created_at), 'MMM d, yyyy')}
        </span>
      </div>
    </div>
    <Button variant="ghost" size="icon">
      <Eye className="w-4 h-4" />
    </Button>
  </div>
);
