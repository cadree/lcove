import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Quote, Star, Send, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { revealMotion } from "@/lib/reveal";
import { usePlatformReviews, useMyPlatformReview, useCreatePlatformReview, useUpdatePlatformReview } from "@/hooks/usePlatformReviews";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

function StarRating({ rating, onRatingChange, readonly = false }: { 
  rating: number; 
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onRatingChange?.(star)}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
        >
          <Star
            className={`w-5 h-5 ${star <= rating ? 'fill-primary text-primary' : 'text-muted-foreground/30'}`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: myReview } = useMyPlatformReview();
  const createReview = useCreatePlatformReview();
  const updateReview = useUpdatePlatformReview();
  
  const [rating, setRating] = useState(myReview?.rating || 5);
  const [content, setContent] = useState(myReview?.content || "");
  const [isEditing, setIsEditing] = useState(!myReview);

  // Update form when myReview loads
  if (myReview && !isEditing && rating !== myReview.rating) {
    setRating(myReview.rating);
    setContent(myReview.content);
  }

  const handleSubmit = () => {
    if (!content.trim()) return;
    
    if (myReview) {
      updateReview.mutate({ id: myReview.id, rating, content }, {
        onSuccess: () => setIsEditing(false)
      });
    } else {
      createReview.mutate({ rating, content }, {
        onSuccess: () => setIsEditing(false)
      });
    }
  };

  if (!user) {
    return (
      <Card className="card-premium">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-4">
            Sign in to share your experience with Ether
          </p>
          <Button onClick={() => navigate('/auth')} className="min-h-11">
            Sign in to review
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (myReview && !isEditing) {
    return (
      <Card className="card-premium border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Your review</span>
              {!myReview.is_approved && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Pending approval</span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          </div>
          <StarRating rating={myReview.rating} readonly />
          <p className="mt-3 text-foreground">{myReview.content}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-premium">
      <CardContent className="p-6">
        <h3 className="font-display text-lg mb-4">
          {myReview ? 'Edit your review' : 'Share your experience'}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Rating</label>
            <StarRating rating={rating} onRatingChange={setRating} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Your honest review</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Your review"
              className="min-h-[100px] resize-none"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{content.length}/500</p>
          </div>
          <div className="flex gap-2">
            {myReview && (
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            )}
            <Button 
              onClick={handleSubmit} 
              disabled={!content.trim() || createReview.isPending || updateReview.isPending}
              className="min-h-11"
            >
              {(createReview.isPending || updateReview.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {myReview ? 'Update Review' : 'Submit Review'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TestimonialsSection() {
  const { data: reviews, isLoading } = usePlatformReviews();
  if (isLoading || !reviews || reviews.length === 0) return null;

  return (
    <section className="py-20 md:py-32">
      <div className="container px-4 sm:px-6 lg:px-8">
        <motion.div
          {...revealMotion({ y: 20 })}
          className="text-center mb-12 md:mb-16"
        >
          <p className="eyebrow mb-2">Reviews</p>
          <h2 className="ether-title text-3xl sm:text-4xl">
            Reviews from members
          </h2>
        </motion.div>

        {/* Reviews Carousel */}
        <motion.div
          {...revealMotion({ y: 20, delay: 0.1 })}
          className="mb-12"
        >
          {reviews && reviews.length > 0 ? (
            <Carousel className="w-full max-w-4xl mx-auto">
              <CarouselContent>
                {reviews.map((review) => (
                  <CarouselItem key={review.id} className="md:basis-1/2">
                    <Card className="h-full card-premium">
                      <CardContent className="p-6 lg:p-8">
                        <div className="flex items-center justify-between mb-4">
                          <Quote className="w-8 h-8 text-primary/30" />
                          <StarRating rating={review.rating} readonly />
                        </div>
                        <p className="text-foreground mb-6 leading-relaxed">
                          "{review.content}"
                        </p>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={review.profiles?.avatar_url || ''} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {review.profiles?.display_name?.split(" ").map(n => n[0]).join("") || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">
                              {review.profiles?.display_name || "Community Member"}
                            </div>
                            {review.profiles?.city && (
                              <div className="text-xs text-muted-foreground">
                                {review.profiles.city}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex -left-12" />
              <CarouselNext className="hidden md:flex -right-12" />
            </Carousel>
          ) : null}
        </motion.div>

        <motion.div
          {...revealMotion({ y: 20, delay: 0.2 })}
          className="max-w-lg mx-auto"
        >
          <ReviewForm />
        </motion.div>
      </div>
    </section>
  );
}
