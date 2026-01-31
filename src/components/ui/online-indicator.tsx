import { cn } from '@/lib/utils';

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showOffline?: boolean;
}

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

export function OnlineIndicator({ 
  isOnline, 
  size = 'md', 
  className,
  showOffline = false 
}: OnlineIndicatorProps) {
  if (!isOnline && !showOffline) return null;

  return (
    <span
      className={cn(
        'rounded-full border-2 border-background',
        sizeClasses[size],
        isOnline 
          ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' 
          : 'bg-muted-foreground/40',
        className
      )}
      title={isOnline ? 'Online' : 'Offline'}
    />
  );
}
