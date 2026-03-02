import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Share2,
  Copy,
  LogIn,
  Target,
  Clock,
  Wrench,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-emerald-500/20 text-emerald-400",
  in_progress: "bg-amber-500/20 text-amber-400",
  completed: "bg-blue-500/20 text-blue-400",
  cancelled: "bg-red-500/20 text-red-400",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function PublicProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: project, isLoading } = useQuery({
    queryKey: ["public-project", projectId],
    queryFn: async () => {
      if (!projectId) throw new Error("No project ID");
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          project_roles (*)
        `)
        .eq("id", projectId)
        .single();
      if (error) throw error;

      // Fetch creator profile
      const { data: creator } = await supabase
        .from("profiles_public")
        .select("display_name, avatar_url")
        .eq("user_id", data.creator_id)
        .maybeSingle();

      return { ...data, roles: data.project_roles || [], creator };
    },
    enabled: !!projectId,
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
  const shareUrl = `${supabaseUrl}/functions/v1/share-page/p/${projectId}`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: project?.title, text: `Check out this project: ${project?.title}`, url: shareUrl });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-lg mx-auto px-4 space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-6">
          <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold mb-2">Project Not Found</h1>
          <p className="text-muted-foreground">This project doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const totalRolePayout = project.roles?.reduce((sum: number, r: any) => sum + r.payout_amount * r.slots_available, 0) || 0;
  const filledSlots = project.roles?.reduce((sum: number, r: any) => sum + r.slots_filled, 0) || 0;
  const totalSlots = project.roles?.reduce((sum: number, r: any) => sum + r.slots_available, 0) || 0;
  const outcomeLabels = project.expected_outcome?.split(", ").filter(Boolean) || [];

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: project.currency || "USD", minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative">
        {project.cover_image_url ? (
          <div className="h-56 sm:h-72 w-full overflow-hidden">
            <img src={project.cover_image_url} alt={project.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </div>
        ) : (
          <div className="h-40 sm:h-56 w-full bg-gradient-to-br from-primary/20 via-primary/10 to-background" />
        )}

        <div className="absolute top-4 right-4 flex gap-2">
          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full backdrop-blur-md bg-background/60" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full backdrop-blur-md bg-background/60" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-12 relative z-10 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/50 shadow-xl bg-card/95 backdrop-blur-md">
            <CardContent className="p-5 space-y-4">
              {/* Status & tags */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn("text-xs", statusColors[project.status])}>
                  {statusLabels[project.status]}
                </Badge>
                {outcomeLabels.slice(0, 3).map((o: string) => (
                  <Badge key={o} variant="outline" className="text-xs">{o}</Badge>
                ))}
              </div>

              <h1 className="text-xl sm:text-2xl font-display font-bold leading-tight">{project.title}</h1>

              {project.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
              )}

              {/* Progress */}
              {project.progress_percent > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-primary font-medium">{project.progress_percent}%</span>
                  </div>
                  <Progress value={project.progress_percent} className="h-1.5" />
                </div>
              )}

              {/* Budget */}
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Budget</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(project.total_budget)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                    style={{ width: `${Math.min((totalRolePayout / Math.max(project.total_budget, 1)) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-muted-foreground">Allocated to roles</span>
                  <span className="font-medium">{formatCurrency(totalRolePayout)}</span>
                </div>
              </div>

              {/* Timeline */}
              {(project.timeline_start || project.timeline_end) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    {project.timeline_start && format(new Date(project.timeline_start), "MMM d, yyyy")}
                    {project.timeline_start && project.timeline_end && " – "}
                    {project.timeline_end && format(new Date(project.timeline_end), "MMM d, yyyy")}
                  </span>
                </div>
              )}

              {/* Venue */}
              {project.venue && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span>{project.venue}</span>
                </div>
              )}

              {/* Team */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <span>{filledSlots}/{totalSlots} roles filled</span>
              </div>

              {/* Roles */}
              {project.roles && project.roles.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/30">
                  <h3 className="text-sm font-semibold">Open Roles</h3>
                  {project.roles.map((role: any) => (
                    <div key={role.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", role.is_locked ? "bg-muted-foreground" : "bg-primary")} />
                        <span className={cn(role.is_locked ? "text-muted-foreground line-through" : "text-foreground")}>{role.role_name}</span>
                        <span className="text-xs text-muted-foreground">({role.slots_filled}/{role.slots_available})</span>
                      </div>
                      <span className="text-primary font-medium">{formatCurrency(role.payout_amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Creator */}
              {project.creator && (
                <div className="flex items-center gap-3 pt-2 border-t border-border/30">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={project.creator.avatar_url || undefined} />
                    <AvatarFallback>{project.creator.display_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs text-muted-foreground">Created by</p>
                    <p className="text-sm font-medium">{project.creator.display_name}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="mt-4 border-border/50 shadow-lg bg-card/95 backdrop-blur-md">
            <CardContent className="p-5 text-center space-y-3">
              <Users className="h-10 w-10 text-primary mx-auto" />
              <h3 className="text-lg font-display font-semibold">Interested in this project?</h3>
              <p className="text-sm text-muted-foreground">
                {user ? "View the full project details and apply for a role." : "Sign in or join the community to apply for open roles."}
              </p>
              {user ? (
                <Button className="gap-2" onClick={() => navigate(`/projects?open=${projectId}`)}>
                  <ChevronRight className="h-4 w-4" />
                  View Full Project
                </Button>
              ) : (
                <Button variant="outline" className="gap-2" onClick={() => navigate(`/auth?redirect=/projects?open=${projectId}`)}>
                  <LogIn className="h-4 w-4" />
                  Sign In to Apply
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}