import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Eye,
  Users,
  Film,
  TrendingUp,
  DollarSign,
  Clock,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface NetworkAnalyticsProps {
  networkId: string;
  network: {
    subscriber_count: number;
    total_views: number;
    is_paid: boolean;
    subscription_price: number;
  };
}

export const NetworkAnalytics = ({ networkId, network }: NetworkAnalyticsProps) => {
  // Fetch content with views
  const { data: content = [], isLoading: contentLoading } = useQuery({
    queryKey: ['network-content-analytics', networkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('network_content')
        .select('id, title, view_count, content_type, created_at, is_published')
        .eq('network_id', networkId)
        .order('view_count', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch subscriptions
  const { data: subscriptions = [], isLoading: subsLoading } = useQuery({
    queryKey: ['network-subscriptions-analytics', networkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('network_subscriptions')
        .select('id, created_at, status, current_period_end')
        .eq('network_id', networkId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch submissions count
  const { data: submissionsData } = useQuery({
    queryKey: ['network-submissions-count', networkId],
    queryFn: async () => {
      const { count: pendingCount } = await supabase
        .from('content_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('network_id', networkId)
        .eq('status', 'pending');

      const { count: totalCount } = await supabase
        .from('content_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('network_id', networkId);

      return { pending: pendingCount || 0, total: totalCount || 0 };
    },
  });

  const isLoading = contentLoading || subsLoading;

  // Calculate stats
  const totalViews = content.reduce((sum, c) => sum + (c.view_count || 0), 0);
  const publishedContent = content.filter(c => c.is_published);
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
  const recentSubscriptions = subscriptions.filter(s => 
    new Date(s.created_at) > subDays(new Date(), 30)
  );

  // Estimated monthly revenue (80% of subscription price * active subscribers)
  const estimatedMonthlyRevenue = network.is_paid 
    ? (activeSubscriptions.length * network.subscription_price * 0.8).toFixed(2)
    : '0.00';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-primary" />}
          label="Active Subscribers"
          value={activeSubscriptions.length}
          subtext={recentSubscriptions.length > 0 ? `+${recentSubscriptions.length} this month` : 'No new this month'}
        />
        <StatCard
          icon={<Eye className="w-5 h-5 text-blue-500" />}
          label="Total Views"
          value={totalViews.toLocaleString()}
          subtext={`Across ${publishedContent.length} published items`}
        />
        <StatCard
          icon={<Film className="w-5 h-5 text-amber-500" />}
          label="Content Library"
          value={content.length}
          subtext={`${publishedContent.length} published`}
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5 text-green-500" />}
          label="Est. Monthly Revenue"
          value={`$${estimatedMonthlyRevenue}`}
          subtext="After platform fees"
        />
      </div>

      {/* Submissions Overview */}
      {submissionsData && (submissionsData.total > 0 || submissionsData.pending > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div>
                <p className="text-2xl font-bold text-amber-500">{submissionsData.pending}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{submissionsData.total}</p>
                <p className="text-sm text-muted-foreground">Total Received</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Top Performing Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          {content.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No content yet. Add content to see analytics.
            </p>
          ) : (
            <div className="space-y-4">
              {content.slice(0, 5).map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4"
                >
                  <span className="text-lg font-bold text-muted-foreground w-6">
                    #{index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {item.content_type.replace('_', ' ')}
                      </Badge>
                      {!item.is_published && (
                        <Badge variant="outline" className="text-xs">Draft</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{(item.view_count || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">views</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Subscribers */}
      {subscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Subscribers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {subscriptions.slice(0, 5).map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="text-sm">
                      Subscribed {format(new Date(sub.created_at), 'MMM d, yyyy')}
                    </p>
                    <Badge variant={sub.status === 'active' ? 'default' : 'secondary'} className="text-xs mt-1">
                      {sub.status}
                    </Badge>
                  </div>
                  {sub.current_period_end && (
                    <p className="text-xs text-muted-foreground">
                      Renews {format(new Date(sub.current_period_end), 'MMM d')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Performance Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Content Published Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {content.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No content published yet.
            </p>
          ) : (
            <div className="space-y-2">
              {content.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 text-sm"
                >
                  <span className="text-muted-foreground w-24 flex-shrink-0">
                    {format(new Date(item.created_at), 'MMM d, yyyy')}
                  </span>
                  <span className="flex-1 truncate">{item.title}</span>
                  <span className="text-muted-foreground">
                    {(item.view_count || 0).toLocaleString()} views
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Stat Card Component
const StatCard = ({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext: string;
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
    </CardContent>
  </Card>
);
