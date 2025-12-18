import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReputation, useReputationLevel } from '@/hooks/useReputation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ReputationScoreProps {
  userId: string;
  variant?: 'default' | 'simple' | 'inline';
  className?: string;
}

const levelLabels = {
  New: 'New Creator',
  Rising: 'Rising Creator',
  Established: 'Trusted Creator',
  Expert: 'Expert Creator',
  Elite: 'Elite Creator',
};

export function ReputationScore({ 
  userId, 
  variant = 'simple',
  className 
}: ReputationScoreProps) {
  const { data: reputation, isLoading } = useReputation(userId);
  const { level } = useReputationLevel(reputation?.overall_score);

  if (isLoading || !reputation) return null;

  // Don't show for new users with no reviews
  if (reputation.review_count === 0) return null;

  const score = reputation.overall_score.toFixed(1);
  const label = levelLabels[level as keyof typeof levelLabels] || 'Creator';

  // Simple inline format: "Trusted Creator • 4.7"
  if (variant === 'simple' || variant === 'inline') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              'inline-flex items-center gap-1.5 text-sm text-muted-foreground',
              className
            )}>
              <span>{label}</span>
              <span className="text-muted-foreground/60">•</span>
              <span className="flex items-center gap-0.5">
                <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                {score}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Based on {reputation.review_count} review{reputation.review_count !== 1 ? 's' : ''}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Default format with more detail
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('inline-flex items-center gap-2', className)}>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-primary text-primary" />
              <span className="font-medium text-foreground">{score}</span>
            </div>
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="w-44">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reviews</span>
              <span>{reputation.review_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Projects</span>
              <span>{reputation.completed_projects}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
