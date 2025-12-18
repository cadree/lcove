import { BadgeCheck, Shield, Star, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VerificationBadgeProps {
  type: 'standard' | 'premium' | 'partner';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const badgeConfig = {
  standard: {
    icon: BadgeCheck,
    color: 'text-primary',
    bg: 'bg-primary/10',
    label: 'Verified Creator',
  },
  premium: {
    icon: Crown,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    label: 'Premium Creator',
  },
  partner: {
    icon: Star,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    label: 'Partner',
  },
};

const sizeConfig = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function VerificationBadge({ 
  type, 
  label, 
  size = 'md', 
  showLabel = false,
  className 
}: VerificationBadgeProps) {
  const config = badgeConfig[type];
  const Icon = config.icon;
  const displayLabel = label || config.label;

  const badge = (
    <span className={cn(
      'inline-flex items-center gap-1',
      showLabel && `${config.bg} px-2 py-0.5 rounded-full`,
      className
    )}>
      <Icon className={cn(sizeConfig[size], config.color)} />
      {showLabel && (
        <span className={cn('text-xs font-medium', config.color)}>
          {displayLabel}
        </span>
      )}
    </span>
  );

  if (showLabel) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>{displayLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
