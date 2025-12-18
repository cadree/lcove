import { motion } from 'framer-motion';
import { Sparkles, RefreshCw, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAIProjectMatches, useRefreshAIMatches, useDismissMatch } from '@/hooks/useAIProjectMatches';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Skeleton } from '@/components/ui/skeleton';

interface AIProjectMatchesProps {
  onViewProject?: (projectId: string) => void;
  className?: string;
}

export function AIProjectMatches({ onViewProject, className }: AIProjectMatchesProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { data: matches, isLoading, error } = useAIProjectMatches();
  const refreshMatches = useRefreshAIMatches();
  const dismissMatch = useDismissMatch();

  // Only show AI matches after onboarding is complete
  if (!user || !profile?.onboarding_completed) return null;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm mb-4">
            Unable to load recommendations right now.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMatches.mutate()}
            disabled={refreshMatches.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshMatches.isPending ? 'animate-spin' : ''}`} />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            No project recommendations yet. Complete your profile to get personalized matches.
          </p>
          <Button
            variant="outline"
            onClick={() => refreshMatches.mutate()}
            disabled={refreshMatches.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshMatches.isPending ? 'animate-spin' : ''}`} />
            Find Matches
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Recommendations
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refreshMatches.mutate()}
          disabled={refreshMatches.isPending}
        >
          <RefreshCw className={`w-4 h-4 ${refreshMatches.isPending ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {matches.map((match, index) => (
          <motion.div
            key={match.project.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative group"
          >
            <div className="glass-card rounded-xl p-4 hover:bg-accent/20 transition-colors">
              <div className="flex items-start gap-4">
                <Avatar className="w-12 h-12 border-2 border-border/50">
                  <AvatarImage src={match.project.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-muted">
                    {match.project.title.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-foreground truncate">
                      {match.project.title}
                    </h4>
                    <Badge variant="secondary" className="text-xs">
                      {match.match_score}% match
                    </Badge>
                  </div>

                  {match.role && (
                    <p className="text-sm text-primary mb-1">
                      {match.role.role_name} · ${match.role.payout_amount}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1 mt-2">
                    {match.reasons.slice(0, 2).map((reason, i) => (
                      <span key={i} className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => dismissMatch.mutate(match.project.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                    onClick={() => onViewProject?.(match.project.id)}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
