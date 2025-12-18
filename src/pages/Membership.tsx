import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Heart, 
  Crown, 
  Check, 
  Sparkles, 
  Gift, 
  Calendar, 
  Award,
  Users,
  Loader2,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { useMembership } from "@/hooks/useMembership";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COMMUNITY_PERKS = [
  "Support the creative community",
  "Visible contribution impact",
  "Community credits bonus monthly",
  "Grant eligibility (after $50 contributed)",
  "Access to member events",
  "Profile badge",
];

const ELITE_PERKS = [
  "Everything in Community",
  "Industry access & networking",
  "Priority grant eligibility",
  "Exclusive Elite events",
  "Early access to features",
  "Premium profile badge",
  "1:1 community support",
];

const Membership = () => {
  const { user } = useAuth();
  const { membership, isLoading, isCheckingOut, checkMembership, startCheckout, openCustomerPortal } = useMembership();
  const [searchParams] = useSearchParams();
  const [communityAmount, setCommunityAmount] = useState<number>(10);

  // Handle success/cancel redirects
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Welcome to the community! Your membership is now active.");
      checkMembership();
    } else if (searchParams.get("cancelled") === "true") {
      toast.info("Checkout was cancelled");
    }
  }, [searchParams, checkMembership]);

  const handleCommunityJoin = () => {
    startCheckout("community", communityAmount);
  };

  const handleEliteJoin = () => {
    startCheckout("elite");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <PageLayout>
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="font-display text-4xl md:text-5xl font-medium text-foreground mb-4">
              Become a Member
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Support the creative community and unlock exclusive benefits. Every contribution goes directly into community grants, events, and education.
            </p>
          </motion.div>

          {/* Current Membership Status */}
          {membership?.subscribed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-14 h-14 rounded-full flex items-center justify-center",
                        membership.tier === "elite" ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-primary"
                      )}>
                        {membership.tier === "elite" ? (
                          <Crown className="w-7 h-7 text-white" />
                        ) : (
                          <Heart className="w-7 h-7 text-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-xl font-medium text-foreground">
                            {membership.tier === "elite" ? "Elite Member" : "Community Member"}
                          </h3>
                          <Badge variant="outline" className="border-primary text-primary">Active</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(membership.monthly_amount || 0)}/month • {formatCurrency(membership.lifetime_contribution)} lifetime
                        </p>
                        {membership.grant_eligible && (
                          <p className="text-sm text-primary flex items-center gap-1 mt-1">
                            <Award className="w-4 h-4" />
                            Grant eligible
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={checkMembership}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                      </Button>
                      <Button variant="outline" size="sm" onClick={openCustomerPortal}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Manage
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Membership Tiers */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Community Member */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className={cn(
                "h-full relative overflow-hidden transition-all",
                membership?.tier === "community" && "border-primary ring-2 ring-primary/20"
              )}>
                {membership?.tier === "community" && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                )}
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <Heart className="w-6 h-6 text-primary" />
                    </div>
                    {membership?.tier === "community" && (
                      <Badge className="bg-primary text-primary-foreground">Your Plan</Badge>
                    )}
                  </div>
                  <CardTitle className="font-display text-2xl">Community Member</CardTitle>
                  <CardDescription>
                    Pay what you can, starting at $5/month
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Price Selector */}
                  {!membership?.subscribed && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-foreground">
                        Choose your contribution
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-display text-foreground">$</span>
                        <Input
                          type="number"
                          min={5}
                          value={communityAmount}
                          onChange={(e) => setCommunityAmount(Math.max(5, parseInt(e.target.value) || 5))}
                          className="w-24 text-xl font-medium text-center"
                        />
                        <span className="text-muted-foreground">/month</span>
                      </div>
                      <div className="flex gap-2">
                        {[5, 10, 25, 50].map((amount) => (
                          <Button
                            key={amount}
                            variant={communityAmount === amount ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCommunityAmount(amount)}
                          >
                            ${amount}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Perks */}
                  <ul className="space-y-3">
                    {COMMUNITY_PERKS.map((perk, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{perk}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {!membership?.subscribed ? (
                    <Button 
                      className="w-full" 
                      onClick={handleCommunityJoin}
                      disabled={isCheckingOut || !user}
                    >
                      {isCheckingOut ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Heart className="w-4 h-4 mr-2" />
                          Join for ${communityAmount}/month
                        </>
                      )}
                    </Button>
                  ) : membership?.tier !== "community" ? (
                    <Button variant="outline" className="w-full" disabled>
                      <Check className="w-4 h-4 mr-2" />
                      Included in Elite
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={openCustomerPortal}>
                      Manage Subscription
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Elite Member */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className={cn(
                "h-full relative overflow-hidden transition-all",
                membership?.tier === "elite" 
                  ? "border-amber-500 ring-2 ring-amber-500/20" 
                  : "border-amber-500/30"
              )}>
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-1",
                  "bg-gradient-to-r from-amber-400 to-orange-500"
                )} />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                    {membership?.tier === "elite" ? (
                      <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0">Your Plan</Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-500">Popular</Badge>
                    )}
                  </div>
                  <CardTitle className="font-display text-2xl">Elite Member</CardTitle>
                  <CardDescription>
                    Industry access and premium perks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Price */}
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-display font-medium text-foreground">$25</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                  </div>

                  {/* Perks */}
                  <ul className="space-y-3">
                    {ELITE_PERKS.map((perk, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{perk}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {!membership?.subscribed ? (
                    <Button 
                      className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white border-0"
                      onClick={handleEliteJoin}
                      disabled={isCheckingOut || !user}
                    >
                      {isCheckingOut ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Crown className="w-4 h-4 mr-2" />
                          Become Elite
                        </>
                      )}
                    </Button>
                  ) : membership?.tier === "elite" ? (
                    <Button variant="outline" className="w-full" onClick={openCustomerPortal}>
                      Manage Subscription
                    </Button>
                  ) : (
                    <Button 
                      className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white border-0"
                      onClick={handleEliteJoin}
                      disabled={isCheckingOut}
                    >
                      Upgrade to Elite
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Impact Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="font-display text-2xl">Where Your Contribution Goes</CardTitle>
                <CardDescription>
                  100% of membership funds go directly into the community
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: "Community Grants", percentage: 40, icon: Gift },
                    { label: "Events", percentage: 20, icon: Calendar },
                    { label: "Education", percentage: 15, icon: Award },
                    { label: "Infrastructure", percentage: 15, icon: Sparkles },
                    { label: "Operations", percentage: 10, icon: Users },
                  ].map((item) => (
                    <div key={item.label} className="text-center p-4 rounded-xl bg-accent/30">
                      <item.icon className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <div className="text-2xl font-display font-medium text-foreground">{item.percentage}%</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Not logged in notice */}
          {!user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center mt-8 p-4 rounded-xl bg-muted/50"
            >
              <p className="text-muted-foreground">
                Please <a href="/auth" className="text-primary hover:underline">sign in</a> to become a member
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default Membership;
