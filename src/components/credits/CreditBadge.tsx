import React from 'react';
import { Coins } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { cn } from '@/lib/utils';

interface CreditBadgeProps {
  userId?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const CreditBadge: React.FC<CreditBadgeProps> = ({
  userId,
  size = 'md',
  showLabel = true,
  className,
}) => {
  const { balance, isLoading } = useCredits(userId);

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

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/20",
      sizeClasses[size],
      className
    )}>
      <Coins className={cn(iconSizes[size], "text-primary")} />
      <span className="text-primary font-semibold">{balance.toLocaleString()}</span>
      {showLabel && <span className="text-primary/70 font-medium">LC</span>}
    </div>
  );
};
