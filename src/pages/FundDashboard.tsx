import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Users, Calendar, GraduationCap, Building2, Briefcase, Sparkles, Heart, Crown, ArrowRight, Wallet, CheckCircle2, PiggyBank } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useMembership } from "@/hooks/useMembership";
import { useAuth } from "@/contexts/AuthContext";
import { useFundStats } from "@/hooks/useFundStats";

const ALLOCATION_DATA = [
  { name: "Community Grants", value: 40, color: "hsl(330, 100%, 71%)", icon: Users, description: "Direct support for creative projects and artist grants" },
  { name: "Events & Activations", value: 20, color: "hsl(30, 30%, 50%)", icon: Calendar, description: "Gatherings, workshops, showcases, and community events" },
  { name: "Education", value: 15, color: "hsl(30, 30%, 65%)", icon: GraduationCap, description: "Learning programs, mentorship, and skill development" },
  { name: "Infrastructure", value: 15, color: "hsl(30, 30%, 40%)", icon: Building2, description: "Platform development, tools, and creative spaces" },
  { name: "Operations", value: 10, color: "hsl(30, 20%, 55%)", icon: Briefcase, description: "Team compensation and community operations" },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const AnimatedNumber = ({ value, prefix = "" }: { value: number; prefix?: string }) => {
  return (
    <motion.span
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {prefix}{value.toLocaleString()}
    </motion.span>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-xl">
        <p className="text-foreground font-medium">{payload[0].payload.month}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm text-muted-foreground">
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-xl">
        <p className="text-foreground font-medium">{data.name}</p>
        <p className="text-primary text-lg font-bold">{data.value}%</p>
        <p className="text-sm text-muted-foreground max-w-[200px]">{data.description}</p>
      </div>
    );
  }
  return null;
};

export default function FundDashboard() {
  const [view, setView] = useState<"lifetime" | "monthly">("lifetime");
  const { user } = useAuth();
  const { membership, isLoading: membershipLoading } = useMembership();
  const { data: fundStats, isLoading: fundLoading } = useFundStats();
  
  const stats = view === "lifetime" ? fundStats?.lifetime : fundStats?.monthly;
  const isMember = membership?.subscribed;

  return (
    <PageLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
          {/* Hero Section */}
          <PageHeader
            title="Community Fund"
            description="Every dollar, every decision, fully visible. See exactly how community contributions fuel creative dreams."
            icon={<PiggyBank className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
            className="mb-8"
          />

          {/* View Toggle */}
          <div className="flex justify-center mb-8">
            <Tabs value={view} onValueChange={(v) => setView(v as "lifetime" | "monthly")} className="w-auto">
              <TabsList className="bg-card/50 backdrop-blur-sm border border-border">
                <TabsTrigger value="lifetime" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Lifetime
                </TabsTrigger>
                <TabsTrigger value="monthly" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  This Month
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Stats Grid */}
          <motion.div
            key={view}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
          >
            <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Total Collected</p>
                {fundLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl md:text-3xl font-bold text-foreground">
                    <AnimatedNumber value={stats?.totalCollected || 0} prefix="$" />
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-secondary/20 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Distributed</p>
                {fundLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <p className="text-2xl md:text-3xl font-bold text-foreground">
                    <AnimatedNumber value={stats?.totalDistributed || 0} prefix="$" />
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-secondary/20 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Grants Awarded</p>
                {fundLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl md:text-3xl font-bold text-foreground">
                    <AnimatedNumber value={stats?.grantsAwarded || 0} />
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden relative">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Creators Supported</p>
                {fundLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                    <AnimatedNumber value={stats?.creatorsSupported || 0} />
                    <Heart className="w-5 h-5 text-primary fill-primary" />
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Charts Section */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Allocation Pie Chart */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-card/50 backdrop-blur-sm border-border h-full">
                <CardHeader>
                  <CardTitle className="text-xl font-serif flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Allocation Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ALLOCATION_DATA}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                          animationBegin={0}
                          animationDuration={1000}
                        >
                          {ALLOCATION_DATA.map((entry, index) => (
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
              <Card className="bg-card/50 backdrop-blur-sm border-border h-full">
                <CardHeader>
                  <CardTitle className="text-xl font-serif flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    6-Month Trend
                  </CardTitle>
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
                            tickFormatter={(value) => `$${value / 1000}k`}
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

          {/* Allocation Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <CardTitle className="text-xl font-serif">Where Your Contribution Goes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {ALLOCATION_DATA.map((item, index) => {
                    const Icon = item.icon;
                    const amount = (stats?.totalDistributed || 0) * item.value / 100;
                    
                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className="flex items-center gap-4 p-4 rounded-xl bg-background/50 hover:bg-background/80 transition-colors"
                      >
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${item.color}20` }}
                        >
                          <Icon className="w-6 h-6" style={{ color: item.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-foreground">{item.name}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {item.value}%
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                        </div>
                        <div className="text-right">
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
                              animate={{ width: `${item.value}%` }}
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

          {/* Member Impact or CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            {isMember ? (
              /* Member Impact Card */
              <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/30 overflow-hidden">
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
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

                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-primary fill-primary" />
                      You're part of {stats?.memberCount || 0}+ members building this community
                    </span>
                    {membership?.grant_eligible && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                        Grant Eligible
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Non-Member CTA */
              <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/30 overflow-hidden">
                <CardContent className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                        <Crown className="w-8 h-8 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-medium text-foreground mb-1">
                          Support the Community
                        </h3>
                        <p className="text-muted-foreground max-w-md">
                          Join {fundStats?.lifetime.memberCount || 0}+ members funding grants, events, and creative opportunities. 
                          Starting at $5/month.
                        </p>
                      </div>
                    </div>
                    <Link to="/membership">
                      <Button size="lg" className="group">
                        Learn More
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* How It Works Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-8"
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <CardTitle className="text-xl font-serif flex items-center gap-2">
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
                <div className="grid md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-background/50">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mb-3">
                      <span className="text-primary font-bold">1</span>
                    </div>
                    <h4 className="font-medium text-foreground mb-1">Members Contribute</h4>
                    <p className="text-sm text-muted-foreground">
                      Monthly contributions from members pool together
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-background/50">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mb-3">
                      <span className="text-primary font-bold">2</span>
                    </div>
                    <h4 className="font-medium text-foreground mb-1">Community Decides</h4>
                    <p className="text-sm text-muted-foreground">
                      Allocation priorities set by member voting
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-background/50">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center mb-3">
                      <span className="text-primary font-bold">3</span>
                    </div>
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
            <p className="text-muted-foreground text-sm">
              Updated in real-time • Audited quarterly • Community-governed decisions
            </p>
          </motion.div>
        </div>
      </div>
    </PageLayout>
  );
}
