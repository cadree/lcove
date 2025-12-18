import { useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Calendar, GraduationCap, Building2, Briefcase, Sparkles, Heart } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";

const ALLOCATION_DATA = [
  { name: "Community Grants", value: 35, color: "hsl(330, 100%, 71%)", icon: Users, description: "Direct support for creative projects" },
  { name: "Events & Activations", value: 25, color: "hsl(30, 30%, 50%)", icon: Calendar, description: "Gatherings, workshops, showcases" },
  { name: "Education", value: 15, color: "hsl(30, 30%, 65%)", icon: GraduationCap, description: "Learning programs & mentorship" },
  { name: "Infrastructure", value: 15, color: "hsl(30, 30%, 40%)", icon: Building2, description: "Platform development & tools" },
  { name: "Operations & Fair Pay", value: 10, color: "hsl(30, 20%, 55%)", icon: Briefcase, description: "Team compensation & overhead" },
];

const MONTHLY_DATA = [
  { month: "Jul", collected: 12400, distributed: 10200 },
  { month: "Aug", collected: 15600, distributed: 13800 },
  { month: "Sep", collected: 18200, distributed: 16400 },
  { month: "Oct", collected: 21500, distributed: 19200 },
  { month: "Nov", collected: 24800, distributed: 22100 },
  { month: "Dec", collected: 28400, distributed: 25600 },
];

const FUND_STATS = {
  lifetime: {
    totalCollected: 245800,
    totalDistributed: 218400,
    grantsAwarded: 47,
    creatorsSupported: 312,
  },
  monthly: {
    totalCollected: 28400,
    totalDistributed: 25600,
    grantsAwarded: 8,
    creatorsSupported: 42,
  },
};

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
  const stats = view === "lifetime" ? FUND_STATS.lifetime : FUND_STATS.monthly;

  return (
    <PageLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">100% Transparent</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
              Community Fund
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Every dollar, every decision, fully visible. See exactly how community contributions 
              fuel creative dreams.
            </p>
          </motion.div>

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
                <p className="text-2xl md:text-3xl font-bold text-foreground">
                  <AnimatedNumber value={stats.totalCollected} prefix="$" />
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-secondary/20 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Distributed</p>
                <p className="text-2xl md:text-3xl font-bold text-foreground">
                  <AnimatedNumber value={stats.totalDistributed} prefix="$" />
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden relative">
              <div className="absolute top-0 right-0 w-20 h-20 bg-secondary/20 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Grants Awarded</p>
                <p className="text-2xl md:text-3xl font-bold text-foreground">
                  <AnimatedNumber value={stats.grantsAwarded} />
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-border overflow-hidden relative">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Creators Supported</p>
                <p className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                  <AnimatedNumber value={stats.creatorsSupported} />
                  <Heart className="w-5 h-5 text-primary fill-primary" />
                </p>
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
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={MONTHLY_DATA} barGap={8}>
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
                    const amount = view === "lifetime" 
                      ? (FUND_STATS.lifetime.totalDistributed * item.value / 100)
                      : (FUND_STATS.monthly.totalDistributed * item.value / 100);
                    
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
                          <p className="font-bold text-foreground">{formatCurrency(amount)}</p>
                          <p className="text-xs text-muted-foreground">{view === "lifetime" ? "all time" : "this month"}</p>
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
