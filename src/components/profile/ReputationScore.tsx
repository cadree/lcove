import { Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReputation, useReputationLevel } from '@/hooks/useReputation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ReputationScoreProps {
  userId: string;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: { icon: 'w-3 h-3', text: 'text-xs', gap: 'gap-1' },
  md: { icon: 'w-4 h-4', text: 'text-sm', gap: 'gap-1.5' },
  lg: { icon: 'w-5 h-5', text: 'text-base', gap: 'gap-2' },
};

const levelColors = {
  New: 'text-muted-foreground',
  Rising: 'text-blue-400',
  Established: 'text-green-400',
  Expert: 'text-primary',
  Elite: 'text-amber-400',
};

export function ReputationScore({ 
  userId, 
  showDetails = false, 
  size = 'md',
  className 
}: ReputationScoreProps) {
  const { data: reputation, isLoading } = useReputation(userId);
  const { level, color } = useReputationLevel(reputation?.overall_score);

  if (isLoading || !reputation) return null;

  const score = reputation.overall_score.toFixed(1);
  const config = sizeConfig[size];
  const levelColor = levelColors[level as keyof typeof levelColors] || 'text-muted-foreground';

  const scoreDisplay = (
    <div className={cn('inline-flex items-center', config.gap, className)}>
      <Star className={cn(config.icon, 'fill-current', levelColor)} />
      <span className={cn(config.text, 'font-medium', levelColor)}>
        {score}
      </span>
      {showDetails && (
        <span className={cn(config.text, 'text-muted-foreground')}>
          ({reputation.review_count} reviews)
        </span>
      )}
    </div>
  );

  if (showDetails) return scoreDisplay;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {scoreDisplay}
        </TooltipTrigger>
        <TooltipContent className="w-48">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Level</span>
              <span className={cn('font-medium', levelColor)}>{level}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reviews</span>
              <span>{reputation.review_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Avg Rating</span>
              <span>{reputation.review_score.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span>{reputation.completed_projects} projects</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
