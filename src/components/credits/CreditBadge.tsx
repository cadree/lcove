import React from 'react';
import { Coins, Flame, Sparkles } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CreditBadgeProps {
  userId?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showSplit?: boolean;
  className?: string;
}

export const CreditBadge: React.FC<CreditBadgeProps> = ({
  userId,
  size = 'md',
  showLabel = true,
  showSplit = false,
  className,
}) => {
  const { balance, genesisBalance, earnedBalance, isLoading } = useCredits(userId);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  if (isLoading) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/10 animate-pulse",
        sizeClasses[size],
        className
      )}>
        <Coins className={cn(iconSizes[size], "text-primary")} />
        <span className="text-primary font-medium">---</span>
      </div>
    );
  }

  if (showSplit) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500/10 via-primary/10 to-primary/10 border border-primary/20",
              sizeClasses[size],
              className
            )}>
              {genesisBalance > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Flame className={cn(iconSizes[size], "text-orange-500")} />
                  <span className="text-orange-600 dark:text-orange-400 font-semibold">
                    {genesisBalance.toLocaleString()}
                  </span>
                </span>
              )}
              {genesisBalance > 0 && earnedBalance > 0 && (
                <span className="text-muted-foreground">+</span>
              )}
              <span className="inline-flex items-center gap-1">
                <Sparkles className={cn(iconSizes[size], "text-primary")} />
                <span className="text-primary font-semibold">
                  {earnedBalance.toLocaleString()}
                </span>
              </span>
              {showLabel && <span className="text-muted-foreground font-medium">LC</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <Flame className="h-3 w-3 text-orange-500" />
                <span>{genesisBalance} Genesis (starter)</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary" />
                <span>{earnedBalance} Earned (contribution)</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/20",
            sizeClasses[size],
            className
          )}>
            <Coins className={cn(iconSizes[size], "text-primary")} />
            <span className="text-primary font-semibold">{balance.toLocaleString()}</span>
            {showLabel && <span className="text-primary/70 font-medium">LC</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <Flame className="h-3 w-3 text-orange-500" />
              <span>{genesisBalance} Genesis</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-primary" />
              <span>{earnedBalance} Earned</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
