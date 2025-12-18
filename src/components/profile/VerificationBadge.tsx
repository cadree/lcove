import { BadgeCheck, Crown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VerificationBadgeProps {
  type: 'standard' | 'premium' | 'partner';
  size?: 'sm' | 'md';
  className?: string;
}

const badgeConfig = {
  standard: {
    icon: BadgeCheck,
    color: 'text-primary',
    label: 'Verified',
  },
  premium: {
    icon: Crown,
    color: 'text-amber-400',
    label: 'Premium',
  },
  partner: {
    icon: Star,
    color: 'text-violet-400',
    label: 'Partner',
  },
};

const sizeConfig = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
};

export function VerificationBadge({ 
  type, 
  size = 'sm',
  className 
}: VerificationBadgeProps) {
  const config = badgeConfig[type];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon className={cn(sizeConfig[size], config.color, className)} />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
