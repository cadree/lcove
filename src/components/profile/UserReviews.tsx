import React, { useState } from 'react';
import { Star, MessageSquare, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserReviews, useReviewStats, useCreateReview, useCanReview } from '@/hooks/useUserReviews';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface UserReviewsProps {
  userId: string;
}

export const UserReviews: React.FC<UserReviewsProps> = ({ userId }) => {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, title: '', content: '' });

  const { data: reviews, isLoading } = useUserReviews(userId);
  const { averageRating, totalReviews, ratingDistribution } = useReviewStats(userId);
  const { data: canReview } = useCanReview(userId);
  const createReview = useCreateReview();

  const handleSubmit = () => {
    createReview.mutate({
      reviewed_user_id: userId,
      ...newReview,
    });
    setCreateOpen(false);
    setNewReview({ rating: 5, title: '', content: '' });
  };

  const renderStars = (rating: number, interactive = false, onChange?: (r: number) => void) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(star)}
            className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
          >
            <Star
              className={`h-5 w-5 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Reviews</CardTitle>
        {user && user.id !== userId && canReview && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Write Review
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Summary */}
        {totalReviews > 0 && (
          <div className="flex gap-6 mb-6 pb-6 border-b">
            <div className="text-center">
              <div className="text-4xl font-bold">{averageRating.toFixed(1)}</div>
              <div className="mt-1">{renderStars(Math.round(averageRating))}</div>
              <div className="text-sm text-muted-foreground mt-1">{totalReviews} reviews</div>
            </div>
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map(rating => (
                <div key={rating} className="flex items-center gap-2">
                  <span className="text-sm w-3">{rating}</span>
                  <Progress 
                    value={totalReviews > 0 ? (ratingDistribution[rating] / totalReviews) * 100 : 0} 
                    className="h-2 flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-6">{ratingDistribution[rating]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews List */}
        {reviews?.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No reviews yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews?.map(review => (
              <div key={review.id} className="border-b pb-4 last:border-0">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={review.reviewer?.avatar_url || undefined} />
                    <AvatarFallback>{review.reviewer?.display_name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{review.reviewer?.display_name || 'Anonymous'}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="mt-1">{renderStars(review.rating)}</div>
                    {review.title && <h4 className="font-medium mt-2">{review.title}</h4>}
                    {review.content && (
                      <p className="text-sm text-muted-foreground mt-1">{review.content}</p>
                    )}
                    {review.project && (
                      <p className="text-xs text-primary mt-2">
                        Project: {review.project.title}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create Review Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write a Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="mt-2">
                {renderStars(newReview.rating, true, (r) => setNewReview({ ...newReview, rating: r }))}
              </div>
            </div>
            <div>
              <Label>Title (optional)</Label>
              <Input
                value={newReview.title}
                onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
                placeholder="Summary of your experience"
              />
            </div>
            <div>
              <Label>Review</Label>
              <Textarea
                value={newReview.content}
                onChange={(e) => setNewReview({ ...newReview, content: e.target.value })}
                placeholder="Share your experience working with this creator..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Submit Review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
