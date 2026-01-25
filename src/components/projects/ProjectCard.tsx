import React from 'react';
import { format } from 'date-fns';
import { Calendar, DollarSign, Users, Clock, ChevronRight } from 'lucide-react';
import { Project } from '@/hooks/useProjects';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-emerald-500/20 text-emerald-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
  const totalRolePayout = project.roles?.reduce((sum, role) => sum + role.payout_amount * role.slots_available, 0) || 0;
  const filledSlots = project.roles?.reduce((sum, role) => sum + role.slots_filled, 0) || 0;
  const totalSlots = project.roles?.reduce((sum, role) => sum + role.slots_available, 0) || 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: project.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div
      onClick={onClick}
      className="group bg-card border border-border rounded-xl p-5 cursor-pointer transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 touch-manipulation active:scale-[0.98]"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      aria-label={`View project: ${project.title}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={cn('text-xs', statusColors[project.status])}>
              {statusLabels[project.status]}
            </Badge>
          </div>
          <h3 className="font-semibold text-lg text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {project.title}
          </h3>
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {project.description}
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </div>

      {/* Budget breakdown */}
      <div className="bg-muted/30 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Total Budget</span>
          <span className="text-lg font-bold text-primary">{formatCurrency(project.total_budget)}</span>
        </div>
        
        {/* Visual budget bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((totalRolePayout / project.total_budget) * 100, 100)}%` }}
          />
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Allocated to roles</span>
          <span className="text-foreground font-medium">{formatCurrency(totalRolePayout)}</span>
        </div>
      </div>

      {/* Roles preview */}
      {project.roles && project.roles.length > 0 && (
        <div className="space-y-2 mb-4">
          {project.roles.slice(0, 3).map((role) => (
            <div key={role.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  role.is_locked ? "bg-muted-foreground" : "bg-primary"
                )} />
                <span className={cn(
                  role.is_locked ? "text-muted-foreground line-through" : "text-foreground"
                )}>
                  {role.role_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({role.slots_filled}/{role.slots_available})
                </span>
              </div>
              <span className="text-primary font-medium">{formatCurrency(role.payout_amount)}</span>
            </div>
          ))}
          {project.roles.length > 3 && (
            <span className="text-xs text-muted-foreground">+{project.roles.length - 3} more roles</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={project.creator?.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {project.creator?.display_name?.[0] || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">
            {project.creator?.display_name || 'Anonymous'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{filledSlots}/{totalSlots}</span>
          </div>
          {project.timeline_end && (
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{format(new Date(project.timeline_end), 'MMM d')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
