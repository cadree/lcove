import { motion } from 'framer-motion';
import { CheckCircle2, Clock, DollarSign, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useProjectMilestones } from '@/hooks/useProjectMilestones';
import { useIsProjectMember } from '@/hooks/useProjectAccess';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface EscrowMilestonesProps {
  projectId: string;
  className?: string;
}

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/20 text-blue-400' },
  submitted: { label: 'Submitted', color: 'bg-amber-500/20 text-amber-400' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400' },
  paid: { label: 'Paid', color: 'bg-primary/20 text-primary' },
};

export function EscrowMilestones({ projectId, className }: EscrowMilestonesProps) {
  const { data: isMember, isLoading: checkingAccess } = useIsProjectMember(projectId);
  const { data: milestones, isLoading } = useProjectMilestones(projectId);

  // Only show to project members
  if (checkingAccess || isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Hide from non-members
  if (!isMember) return null;

  if (!milestones || milestones.length === 0) return null;

  const completedCount = milestones.filter(m => m.status === 'paid').length;
  const progressPercent = (completedCount / milestones.length) * 100;
  const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
  const paidAmount = milestones
    .filter(m => m.status === 'paid')
    .reduce((sum, m) => sum + m.amount, 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="w-4 h-4 text-muted-foreground" />
          Payment Milestones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {completedCount} of {milestones.length} completed
            </span>
            <span className="text-foreground font-medium">
              ${paidAmount.toLocaleString()} / ${totalAmount.toLocaleString()}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Milestone List */}
        <div className="space-y-3">
          {milestones.map((milestone, index) => (
            <motion.div
              key={milestone.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                milestone.status === 'paid' ? 'bg-green-500/20' : 'bg-muted'
              )}>
                {milestone.status === 'paid' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate">
                  {milestone.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  ${milestone.amount.toLocaleString()}
                </p>
              </div>

              <Badge 
                variant="secondary" 
                className={cn('text-xs', statusConfig[milestone.status].color)}
              >
                {statusConfig[milestone.status].label}
              </Badge>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
