import { motion } from 'framer-motion';
import { Coins, FolderKanban, CalendarDays, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileStatsProps {
  credits: number;
  projectCount: number;
  eventCount: number;
  reviewScore?: number | null;
}

export function ProfileStats({ credits, projectCount, eventCount, reviewScore }: ProfileStatsProps) {
  const stats = [
    { 
      icon: Coins, 
      value: credits, 
      label: 'Credits',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    { 
      icon: FolderKanban, 
      value: projectCount, 
      label: 'Projects',
      color: 'text-accent-foreground',
      bgColor: 'bg-accent/30',
    },
    { 
      icon: CalendarDays, 
      value: eventCount, 
      label: 'Events',
      color: 'text-foreground',
      bgColor: 'bg-muted',
    },
    ...(reviewScore !== null && reviewScore !== undefined ? [{
      icon: Star, 
      value: reviewScore.toFixed(1), 
      label: 'Rating',
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
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
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + index * 0.05 }}
              className={cn(
                "flex flex-col items-center justify-center py-3 px-2 rounded-xl",
                "glass-subtle"
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
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
