import { motion } from 'framer-motion';
import { Coins, FolderKanban, CalendarDays, Star, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FriendsDrawer } from '@/components/friends/FriendsDrawer';

interface ProfileStatsProps {
  credits: number;
  projectCount: number;
  eventCount: number;
  reviewScore?: number | null;
  friendsCount?: number;
  isOwnProfile?: boolean;
}

export function ProfileStats({ 
  credits, 
  projectCount, 
  eventCount, 
  reviewScore,
  friendsCount = 0,
  isOwnProfile = false,
}: ProfileStatsProps) {
  const stats = [
    { 
      icon: Coins, 
      value: credits, 
      label: 'Credits',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      clickable: false,
    },
    { 
      icon: FolderKanban, 
      value: projectCount, 
      label: 'Projects',
      color: 'text-accent-foreground',
      bgColor: 'bg-accent/30',
      clickable: false,
    },
    { 
      icon: CalendarDays, 
      value: eventCount, 
      label: 'Events',
      color: 'text-foreground',
      bgColor: 'bg-muted',
      clickable: false,
    },
    ...(isOwnProfile ? [{
      icon: Users, 
      value: friendsCount, 
      label: 'Friends',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      clickable: true,
    }] : []),
    ...(reviewScore !== null && reviewScore !== undefined ? [{
      icon: Star, 
      value: reviewScore.toFixed(1), 
      label: 'Rating',
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      clickable: false,
    }] : []),
  ];

  const StatCard = ({ stat, index }: { stat: typeof stats[0], index: number }) => {
    const Icon = stat.icon;
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 + index * 0.05 }}
        className={cn(
          "flex flex-col items-center justify-center py-3 px-2 rounded-xl",
          "glass-subtle",
          stat.clickable && "cursor-pointer hover:bg-muted/50 transition-colors"
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
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="px-5 py-4"
    >
      <div className={cn(
        "grid gap-3",
        stats.length >= 5 ? "grid-cols-5" : stats.length === 4 ? "grid-cols-4" : "grid-cols-3"
      )}>
        {stats.map((stat, index) => {
          if (stat.clickable && stat.label === 'Friends') {
            return (
              <FriendsDrawer key={stat.label}>
                <StatCard stat={stat} index={index} />
              </FriendsDrawer>
            );
          }
          return <StatCard key={stat.label} stat={stat} index={index} />;
        })}
      </div>
    </motion.div>
  );
}
