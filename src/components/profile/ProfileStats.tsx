import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coins, FolderKanban, CalendarDays, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileStatsProps {
  credits: number;
  projectCount: number;
  eventCount: number;
  reviewScore?: number | null;
  isOwnProfile?: boolean;
}

export function ProfileStats({ credits, projectCount, eventCount, reviewScore, isOwnProfile = false }: ProfileStatsProps) {
  const navigate = useNavigate();
  
  const stats = [
    { 
      icon: Coins, 
      value: credits, 
      label: 'Credits',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      onClick: isOwnProfile ? () => navigate('/wallet') : undefined,
    },
    { 
      icon: FolderKanban, 
      value: projectCount, 
      label: 'Projects',
      color: 'text-accent-foreground',
      bgColor: 'bg-accent/30',
      onClick: isOwnProfile ? () => navigate('/projects') : undefined,
    },
    { 
      icon: CalendarDays, 
      value: eventCount, 
      label: 'Events',
      color: 'text-foreground',
      bgColor: 'bg-muted',
      onClick: isOwnProfile ? () => navigate('/dashboard/events') : undefined,
    },
    ...(reviewScore !== null && reviewScore !== undefined ? [{
      icon: Star, 
      value: reviewScore.toFixed(1), 
      label: 'Rating',
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      onClick: undefined,
    }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="px-5 py-4"
    >
      <div className={cn(
        "grid gap-3",
        stats.length === 4 ? "grid-cols-4" : "grid-cols-3"
      )}>
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const isClickable = !!stat.onClick;
          
          return (
            <motion.button
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + index * 0.05 }}
              onClick={stat.onClick}
              disabled={!isClickable}
              className={cn(
                "flex flex-col items-center justify-center py-3 px-2 rounded-xl",
                "glass-subtle transition-all duration-200",
                isClickable && "hover:scale-105 hover:bg-accent/20 cursor-pointer active:scale-95",
                !isClickable && "cursor-default"
              )}
            >
              <div className={cn("p-2 rounded-full mb-1.5", stat.bgColor)}>
                <Icon className={cn("w-4 h-4", stat.color)} />
              </div>
              <span className="font-display text-lg font-semibold text-foreground">
                {stat.value}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}