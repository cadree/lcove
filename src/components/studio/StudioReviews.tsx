import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star } from 'lucide-react';
import { useStudioReviews, useSubmitReview, StudioReview } from '@/hooks/useStudioBookings';
import { useProfile } from '@/hooks/useProfile';
import { format } from 'date-fns';

interface StudioReviewsProps {
  itemId: string;
  canReview?: boolean;
  bookingId?: string;
}

const ReviewItem: React.FC<{ review: StudioReview }> = ({ review }) => {
  const { profile } = useProfile(review.reviewer_id);

  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      <Avatar className="h-10 w-10">
        <AvatarImage src={profile?.avatar_url || undefined} />
        <AvatarFallback>{profile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium">{profile?.display_name || 'User'}</span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(review.created_at), 'MMM d, yyyy')}
          </span>
        </div>
        <div className="flex gap-0.5 my-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-4 w-4 ${
                star <= review.rating ? 'fill-primary text-primary' : 'text-muted'
              }`}
            />
          ))}
        </div>
        {review.review && (
          <p className="text-sm text-muted-foreground mt-1">{review.review}</p>
        )}
      </div>
    </div>
  );
};

export const StudioReviews: React.FC<StudioReviewsProps> = ({ itemId, canReview, bookingId }) => {
  const { data: reviews = [] } = useStudioReviews(itemId);
  const submitReview = useSubmitReview();
  
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [showForm, setShowForm] = useState(false);

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const handleSubmit = async () => {
    if (!bookingId) return;
    await submitReview.mutateAsync({
      item_id: itemId,
      booking_id: bookingId,
      rating,
      review: reviewText,
    });
    setShowForm(false);
    setReviewText('');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Reviews</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= Math.round(averageRating) ? 'fill-primary text-primary' : 'text-muted'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {averageRating.toFixed(1)} ({reviews.length})
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {canReview && bookingId && !showForm && (
          <Button 
            variant="outline" 
            className="w-full mb-4"
            onClick={() => setShowForm(true)}
          >
            Write a Review
          </Button>
        )}

        {showForm && (
          <div className="space-y-3 mb-4 p-3 bg-muted rounded-lg">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= rating ? 'fill-primary text-primary' : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitReview.isPending} className="flex-1">
                Submit
              </Button>
            </div>
          </div>
        )}

        {reviews.length > 0 ? (
          <div className="space-y-0">
            {reviews.map((review) => (
              <ReviewItem key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-4">No reviews yet</p>
        )}
      </CardContent>
    </Card>
  );
};
