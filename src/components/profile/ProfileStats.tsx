import { useNavigate } from 'react-router-dom';
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
      value: credits,
      label: 'Credits',
      onClick: isOwnProfile ? () => navigate('/wallet') : undefined,
    },
    {
      value: projectCount,
      label: 'Projects',
      onClick: isOwnProfile ? () => navigate('/projects') : undefined,
    },
    {
      value: eventCount,
      label: 'Events',
      onClick: isOwnProfile ? () => navigate('/dashboard/events') : undefined,
    },
    ...(reviewScore !== null && reviewScore !== undefined ? [{
      value: reviewScore.toFixed(1),
      label: 'Rating',
      onClick: undefined,
    }] : []),
  ];

  return (
    <div className="px-4 py-4">
      <div className={cn(
        "grid gap-2",
        stats.length === 4 ? "grid-cols-4" : "grid-cols-3"
      )}>
        {stats.map((stat) => {
          const isClickable = !!stat.onClick;
          return (
            <button
              key={stat.label}
              type="button"
              onClick={stat.onClick}
              disabled={!isClickable}
              className={cn(
                "file-panel flex min-h-11 flex-col items-center justify-center px-1 py-3",
                isClickable ? "cursor-pointer" : "cursor-default"
              )}
            >
              <span className="font-body text-[19px] font-extrabold text-foreground">{stat.value}</span>
              <span className="mono-label text-[8px] text-muted-foreground">{stat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}