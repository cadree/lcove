import { motion } from 'framer-motion';
import { Star, Crown, ExternalLink } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFeaturedCreators } from '@/hooks/useFeaturedCreators';
import { VerificationBadge } from '@/components/profile/VerificationBadge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface FeaturedCreatorsCarouselProps {
  featureType?: 'weekly' | 'monthly' | 'spotlight';
  onCreatorClick?: (userId: string) => void;
  className?: string;
}

export function FeaturedCreatorsCarousel({ 
  featureType, 
  onCreatorClick,
  className 
}: FeaturedCreatorsCarouselProps) {
  const { data: creators, isLoading } = useFeaturedCreators(featureType);

  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-5 h-5 text-amber-400" />
          <h3 className="font-display text-lg font-medium">Featured Creators</h3>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-64 flex-shrink-0">
              <Skeleton className="h-48 rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!creators || creators.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Crown className="w-5 h-5 text-amber-400" />
        <h3 className="font-display text-lg font-medium">Featured Creators</h3>
        <Badge variant="secondary" className="text-xs">
          {featureType === 'weekly' ? 'This Week' : featureType === 'monthly' ? 'This Month' : 'Spotlight'}
        </Badge>
      </div>

      <Carousel
        opts={{
          align: 'start',
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2">
          {creators.map((creator, index) => (
            <CarouselItem key={creator.id} className="pl-2 basis-full sm:basis-1/2 lg:basis-1/3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => onCreatorClick?.(creator.user_id)}
                className="cursor-pointer"
              >
                <div className="glass-card rounded-2xl overflow-hidden group hover:shadow-lg transition-all">
                  {/* Cover Image */}
                  <div className="relative h-24 bg-gradient-to-br from-primary/20 to-accent/20">
                    {creator.cover_image_url && (
                      <img 
                        src={creator.cover_image_url} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                  </div>

                  {/* Content */}
                  <div className="p-4 -mt-8 relative">
                    <Avatar className="w-14 h-14 border-3 border-card">
                      <AvatarImage src={creator.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-muted text-lg">
                        {creator.profile?.display_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground truncate">
                          {creator.profile?.display_name || 'Creator'}
                        </h4>
                        {creator.verification && (
                          <VerificationBadge 
                            type={creator.verification.verification_type as any} 
                            size="sm"
                          />
                        )}
                      </div>

                      {creator.title && (
                        <p className="text-sm text-primary mt-1">{creator.title}</p>
                      )}

                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {creator.description || creator.profile?.bio || 'Featured creator'}
                      </p>

                      {creator.profile?.city && (
                        <p className="text-xs text-muted-foreground mt-2">
                          📍 {creator.profile.city}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden sm:flex -left-4" />
        <CarouselNext className="hidden sm:flex -right-4" />
      </Carousel>
    </div>
  );
}
