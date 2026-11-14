import { useEffect, useState, forwardRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar, GraduationCap, Building2, Briefcase, Heart, Crown, ArrowRight, Wallet, CheckCircle2, PiggyBank, RefreshCw } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useMembership } from "@/hooks/useMembership";
import { useIosExternalCheckout } from "@/hooks/useIosExternalCheckout";
import { useAuth } from "@/contexts/AuthContext";
import { useFundStats } from "@/hooks/useFundStats";
import { RecentDistributionsCard } from "@/components/fund/FundDistributions";
import { DonateDialog } from "@/components/fund/DonateDialog";
import { SUPPORT_IN_SAFARI_LABEL, SUPPORT_NOW_LABEL } from "@/lib/supportCopy";
import { IosDigitalGoodsNotice } from "@/components/ios/IosDigitalGoodsNotice";
import { IOS_DONATIONS_ENABLED, digitalPurchasesEnabled, isIosApp } from "@/lib/platform";
import { toast } from "sonner";
import { SquircleIcon, iconFills } from "@/components/world/SquircleIcon";
import { formatAxisDollars } from "@/lib/formatAxisDollars";
import { PageMeta } from "@/components/seo/PageMeta";

const ALLOCATION_DATA = [
  { name: "Community Grants", key: "communityGrants", color: "hsl(330, 100%, 71%)", icon: Users, description: "Direct support for creative projects and artist grants" },
  { name: "Events & Activations", key: "eventsActivations", color: "hsl(30, 30%, 50%)", icon: Calendar, description: "Gatherings, workshops, showcases, and community events" },
  { name: "Education", key: "education", color: "hsl(30, 30%, 65%)", icon: GraduationCap, description: "Learning programs, mentorship, and skill development" },
  { name: "Infrastructure", key: "infrastructure", color: "hsl(30, 30%, 40%)", icon: Building2, description: "Platform development, tools, and creative spaces" },
  { name: "Operations", key: "operations", color: "hsl(30, 20%, 55%)", icon: Briefcase, description: "Team compensation and community operations" },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const AnimatedNumber = forwardRef<HTMLSpanElement, { value: number; prefix?: string }>(
  ({ value, prefix = "" }, ref) => {
    return (
      <motion.span
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        key={value}
      >
        {prefix}{value.toLocaleString()}
      </motion.span>
    );
  }
);

AnimatedNumber.displayName = "AnimatedNumber";

interface FundTooltipEntry {
  name?: string;
  value?: number;
  payload?: {
    month?: string;
    name?: string;
    value?: number;
    description?: string;
  };
}

interface FundTooltipProps {
  active?: boolean;
  payload?: FundTooltipEntry[];
}

const CustomTooltip = forwardRef<HTMLDivElement, FundTooltipProps>(({ active, payload }, ref) => {
  if (active && payload && payload.length) {
    return (
      <div ref={ref} className="bg-card/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-xl">
        <p className="text-foreground font-medium">{payload[0].payload?.month}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm text-muted-foreground">
            {entry.name}: {formatCurrency(entry.value ?? 0)}
          </p>
        ))}
      </div>
    );
  }
  return null;
});

CustomTooltip.displayName = "CustomTooltip";

const PieTooltip = forwardRef<HTMLDivElement, FundTooltipProps>(({ active, payload }, ref) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (!data) return null;
    return (
      <div ref={ref} className="bg-card/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-xl">
        <p className="text-foreground font-medium">{data.name}</p>
        <p className="text-primary text-lg font-bold">{formatCurrency(data.value ?? 0)}</p>
        <p className="text-sm text-muted-foreground max-w-[200px]">{data.description}</p>
      </div>
    );
  }
  return null;
});

PieTooltip.displayName = "PieTooltip";

export default function FundDashboard() {
  const [view, setView] = useState<"lifetime" | "monthly">("lifetime");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { membership, isLoading: membershipLoading, checkMembership, openCustomerPortal } = useMembership();
  const [searchParams] = useSearchParams();
  const { linkOut } = useIosExternalCheckout();
  const { data: fundStats, isLoading: fundLoading, isError: fundFailed, refetch, isFetching } = useFundStats();
  const fundEmpty = !fundLoading && !fundFailed && (fundStats?.lifetime.totalCollected ?? 0) === 0 && (fundStats?.lifetime.totalDistributed ?? 0) === 0 && (fundStats?.recentDistributions.length ?? 0) === 0;
  
  const iosApp = isIosApp();
  const showDonations = !iosApp || IOS_DONATIONS_ENABLED || linkOut;
  const hideDigitalPurchases = !digitalPurchasesEnabled() && !linkOut;

  useEffect(() => {
    const donated = searchParams.get("donated") === "true";
    const cancelled = searchParams.get("cancelled") === "true";
    if (!donated && !cancelled) return;
    if (cancelled) {
      toast.info("Support was cancelled");
      return;
    }
    toast.success("Thank you. Your support shows here after Stripe confirms it.");
    void checkMembership();
    void refetch();
  }, [searchParams, checkMembership, refetch]);
  const stats = view === "lifetime" ? fundStats?.lifetime : fundStats?.monthly;
  const isMember = membership?.subscribed;

  // Prepare pie chart data with actual dollar amounts
  const pieChartData = ALLOCATION_DATA.map(item => ({
    ...item,
    value: fundStats?.allocations?.[item.key as keyof typeof fundStats.allocations] || 0,
  }));
  const allocationTotal = pieChartData.reduce((sum, item) => sum + item.value, 0);

  const handleContribute = async () => {
    if (!user) {
      toast.error("Please sign in to contribute");
      navigate("/auth");
      return;
    }

    if (!isMember) {
      navigate("/membership");
      return;
    }

    // Already a member - just show a toast
    toast.info("You're already a member! Manage your subscription below.");
  };

  const handleManageSubscription = async () => {
    try {
      await openCustomerPortal();
    } catch (error) {
      console.error('Error opening portal:', error);
      toast.error("Failed to open subscription management");
    }
  };

  return (
    <PageLayout>
      <PageMeta title="Fund · Ether" description="Community fund activity, updated in real time." />
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
          {/* Hero Section */}
          <PageHeader
            eyebrow="Neo gold"
            title="Fund"
            description="Every dollar, every decision, fully visible."
            icon={<PiggyBank className="w-5 h-5" />}
            tile="gold"
            className="mb-6"
          />

          <div className="mb-6 flex items-center gap-3">
            <Tabs value={view} onValueChange={(v) => setView(v as "lifetime" | "monthly")} className="w-auto">
              <TabsList className="h-auto gap-1 rounded-none border-0 bg-transparent p-0">
                <TabsTrigger value="lifetime" className="mono-label h-11 rounded-none border-0 border-b-2 border-transparent text-[11px] shadow-none data-[state=active]:border-[hsl(var(--bubble))] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
                  Lifetime
                </TabsTrigger>
                <TabsTrigger value="monthly" className="mono-label h-11 rounded-none border-0 border-b-2 border-transparent text-[11px] shadow-none data-[state=active]:border-[hsl(var(--bubble))] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
                  This month
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              className="shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="flex justify-center mb-6">
            {fundLoading ? (
              <p className="text-xs text-muted-foreground">Loading fund totals…</p>
            ) : fundFailed ? (
              <div className="text-center space-y-2">
                <p className="text-sm text-destructive">Fund totals could not be loaded.</p>
                <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
              </div>
            ) : fundEmpty ? (
              <p className="text-sm text-muted-foreground">No contributions recorded yet.</p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live updates enabled
              </div>
            )}
          </div>

          {fundFailed ? null : (
          <>
          {/* Stats Grid */}
          <motion.div
            key={view}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
          >
            {[
              ["// Collected", stats?.totalCollected || 0, "$"],
              ["// Distributed", stats?.totalDistributed || 0, "$"],
              ["// Grants", stats?.grantsAwarded || 0, ""],
              ["// Creators", stats?.creatorsSupported || 0, ""],
            ].map(([label, value, prefix]) => (
              <div key={String(label)} className="file-panel px-4 py-4">
                <p className="kicker">{label}</p>
                {fundLoading ? (
                  <Skeleton className="mt-2 h-8 w-24" />
                ) : (
                  <p className="ether-title mt-2 text-[28px] text-foreground">
                    <AnimatedNumber value={Number(value)} prefix={String(prefix)} />
                  </p>
                )}
              </div>
            ))}
          </motion.div>

          {/* Charts Section */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Allocation Pie Chart */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-border bg-card h-full">
                <CardHeader>
                  <p className="kicker">// Allocation</p>
                  <CardTitle className="ether-title text-[22px]">Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {!fundLoading && allocationTotal <= 0 ? (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <p className="font-medium text-foreground">No allocations yet</p>
                        <p className="mt-1 max-w-[240px] text-sm text-muted-foreground">
                          Distributions will appear here once the fund pays out.
                        </p>
                      </div>
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                          animationBegin={0}
                          animationDuration={1000}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.color}
                              className="hover:opacity-80 transition-opacity cursor-pointer"
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Monthly Trend Chart */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-border bg-card h-full">
                <CardHeader>
                  <p className="kicker">// Trend</p>
                  <CardTitle className="ether-title text-[22px]">Six months</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {fundLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Skeleton className="h-full w-full" />
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={fundStats?.monthlyTrend || []} barGap={8}>
                          <XAxis 
                            dataKey="month" 
                            axisLine={false} 
                            tickLine={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            tickFormatter={(value) => formatAxisDollars(Number(value))}
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend 
                            wrapperStyle={{ paddingTop: 20 }}
                            formatter={(value) => <span className="text-muted-foreground text-sm">{value}</span>}
                          />
                          <Bar 
                            dataKey="collected" 
                            name="Collected"
                            fill="hsl(330, 100%, 71%)" 
                            radius={[4, 4, 0, 0]}
                            animationDuration={1000}
                          />
                          <Bar 
                            dataKey="distributed" 
                            name="Distributed"
                            fill="hsl(30, 30%, 50%)" 
                            radius={[4, 4, 0, 0]}
                            animationDuration={1000}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Allocation Details - No percentages, just dollar amounts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-border bg-card">
              <CardHeader>
                <p className="kicker">// File</p>
                <CardTitle className="ether-title text-[22px]">Where it goes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {ALLOCATION_DATA.map((item, index) => {
                    const Icon = item.icon;
                    const amount = fundStats?.allocations?.[item.key as keyof typeof fundStats.allocations] || 0;
                    const totalDistributed = fundStats?.lifetime.totalDistributed || 1;
                    const percentage = totalDistributed > 0 ? (amount / totalDistributed) * 100 : 0;
                    
                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className="flex items-start gap-3 p-3 sm:gap-4 sm:p-4 rounded-xl bg-background/50 hover:bg-background/80 transition-colors"
                      >
                        <div 
                          className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${item.color}20` }}
                        >
                          <Icon className="w-6 h-6" style={{ color: item.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-foreground">{item.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-normal">{item.description}</p>
                        </div>
                        <div className="shrink-0 text-right whitespace-nowrap">
                          {fundLoading ? (
                            <Skeleton className="h-6 w-20" />
                          ) : (
                            <>
                              <p className="font-bold text-foreground">{formatCurrency(amount)}</p>
                              <p className="text-xs text-muted-foreground">{view === "lifetime" ? "all time" : "this month"}</p>
                            </>
                          )}
                        </div>
                        <div className="hidden md:block w-32">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 1, delay: 0.2 * index }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          </>
          )}

          {/* Member Impact or CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            {isMember ? (
              /* Member Impact Card */
              <Card className="overflow-hidden">
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <SquircleIcon icon={CheckCircle2} fill="green" size={40} />
                    <div>
                      <h3 className="font-display text-lg font-medium text-foreground">Your Impact</h3>
                      <p className="text-sm text-muted-foreground">Thank you for being a member</p>
                    </div>
                    <Badge className="ml-auto capitalize">{membership?.tier} Member</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 rounded-xl bg-background/50">
                      <p className="text-2xl font-bold text-foreground">
                        {formatCurrency(membership?.lifetime_contribution || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Your total contribution</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-background/50">
                      <p className="text-2xl font-bold text-foreground">
                        {formatCurrency((membership?.lifetime_contribution || 0) * 0.4)}
                      </p>
                      <p className="text-xs text-muted-foreground">Funded grants</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-background/50">
                      <p className="text-2xl font-bold text-foreground">
                        {formatCurrency((membership?.lifetime_contribution || 0) * 0.2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Supported events</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-background/50">
                      <p className="text-2xl font-bold text-foreground">
                        {Math.round((membership?.lifetime_contribution || 0) / 50)}
                      </p>
                      <p className="text-xs text-muted-foreground">Creators helped</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {membership?.grant_eligible && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                        Grant Eligible
                      </Badge>
                    </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {showDonations ? (
                      <DonateDialog>
                        <Button variant="default" size="sm">
                          <Heart className="w-3.5 h-3.5 mr-1.5" />
                          {linkOut ? "Extra support in Safari" : "Extra support"}
                        </Button>
                      </DonateDialog>
                      ) : (
                        <IosDigitalGoodsNotice kind="donation" className="max-w-xs" />
                      )}
                      {!hideDigitalPurchases && (
                        <Button variant="outline" size="sm" onClick={handleManageSubscription}>
                          {linkOut ? "Manage in Safari" : "Manage Subscription"}
                        </Button>
                      )}
                      {hideDigitalPurchases && <IosDigitalGoodsNotice kind="billing" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Non-Member CTA */
              <Card className="overflow-hidden">
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <SquircleIcon icon={Crown} fill="gold" size={54} glyph={28} />
                      <div>
                        <h3 className="font-display text-xl font-medium text-foreground mb-1">
                          Support Ether
                        </h3>
                        <p className="text-muted-foreground max-w-md">
                          {linkOut
                            ? "Support once or subscribe monthly. Checkout opens in Safari."
                            : hideDigitalPurchases
                            ? showDonations
                              ? "Membership checkout is not available in the iOS app. You can still support."
                              : "Membership checkout is not available in the iOS app."
                            : "Support once or subscribe monthly — no account required."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      {showDonations ? (
                      <DonateDialog>
                        <Button size="lg" className="group">
                          {linkOut ? SUPPORT_IN_SAFARI_LABEL : SUPPORT_NOW_LABEL}
                          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </DonateDialog>
                      ) : (
                        <IosDigitalGoodsNotice kind="donation" className="max-w-xs" />
                      )}
                      {hideDigitalPurchases ? (
                        <IosDigitalGoodsNotice className="max-w-xs" />
                      ) : (
                      <Button 
                        size="lg" 
                        variant="outline"
                        onClick={handleContribute}
                      >
                        Become a Member
                      </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Recent Distributions - Real Data */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52 }}
            className="mt-8"
          >
            <RecentDistributionsCard recentDistributions={fundStats?.recentDistributions} />
          </motion.div>

          {/* How It Works Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-8"
          >
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-xl ether-title flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  How the Fund Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                  The Community Fund is the financial backbone of our creative ecosystem. 
                  Unlike traditional platforms that extract value, every dollar contributed here 
                  goes directly back into supporting creators.
                </p>
                <div className="grid md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-background/50">
                    <span className="squircle-icon mb-3 font-body text-sm font-extrabold" style={{ width: 32, height: 32, backgroundImage: iconFills.gold, color: "#0A0A0A" }}>1</span>
                    <h4 className="font-medium text-foreground mb-1">Members Contribute</h4>
                    <p className="text-sm text-muted-foreground">
                      Monthly contributions from members pool together
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-background/50">
                    <span className="squircle-icon mb-3 font-body text-sm font-extrabold" style={{ width: 32, height: 32, backgroundImage: iconFills.gold, color: "#0A0A0A" }}>2</span>
                    <h4 className="font-medium text-foreground mb-1">Creators Benefit</h4>
                    <p className="text-sm text-muted-foreground">
                      Funds distributed to grants, events, and programs
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Trust Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 text-center"
          >
            <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Updated in real-time
            </p>
          </motion.div>
        </div>
      </div>
    </PageLayout>
  );
}
