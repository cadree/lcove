import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronRight,
  Send,
  Check,
  Lock,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { shareLink, buildShareUrl } from "@/lib/shareLink";
import { cn } from "@/lib/utils";
import { ProjectDetail } from "@/components/projects/ProjectDetail";
import type { Project } from "@/hooks/useProjects";

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
  const queryClient = useQueryClient();

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [applicationMessage, setApplicationMessage] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);

  // Guest form state
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPortfolio, setGuestPortfolio] = useState("");
  const [guestMessage, setGuestMessage] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["public-project", projectId],
    queryFn: async () => {
      if (!projectId) throw new Error("No project ID");
      const { data, error } = await supabase
        .from("projects")
        .select(`*, project_roles (*)`)
        .eq("id", projectId)
        .single();
      if (error) throw error;

      // Use security definer function to get creator profile (works for anon)
      const { data: creatorRows } = await supabase
        .rpc("get_public_creator_profile", { creator_user_id: data.creator_id });
      const creator = creatorRows?.[0] || null;

      return { ...data, roles: data.project_roles || [], creator };
    },
    enabled: !!projectId,
  });

  // Fetch user's existing applications (authenticated only)
  const { data: myApplications = [] } = useQuery({
    queryKey: ["my-project-applications", projectId, user?.id],
    queryFn: async () => {
      if (!user?.id || !projectId) return [];
      const { data, error } = await supabase
        .from("project_applications")
        .select("id, role_id, status")
        .eq("project_id", projectId)
        .eq("applicant_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!projectId,
  });

  // Authenticated apply mutation
  const applyMutation = useMutation({
    mutationFn: async ({ roleId, message }: { roleId: string; message: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase.from("project_applications").insert({
        project_id: projectId!,
        role_id: roleId,
        applicant_id: user.id,
        message: message || null,
      });
      if (error) throw error;

      try {
        const { data: proj } = await supabase
          .from("projects")
          .select("title, creator_id")
          .eq("id", projectId!)
          .single();
        const { data: role } = await supabase
          .from("project_roles")
          .select("role_name")
          .eq("id", roleId)
          .single();
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .single();
        if (proj && role) {
          await supabase.functions.invoke("notify-new-application", {
            body: {
              project_id: projectId,
              project_creator_id: proj.creator_id,
              project_title: proj.title,
              role_title: role.role_name,
              applicant_name: profile?.display_name || "Someone",
            },
          });
        }
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-project-applications"] });
      toast.success("Application submitted!");
      setSelectedRoleId(null);
      setApplicationMessage("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to apply");
    },
  });

  // Guest apply mutation
  const guestApplyMutation = useMutation({
    mutationFn: async ({ roleId }: { roleId: string }) => {
      const { error } = await supabase.from("guest_role_applications" as any).insert({
        project_id: projectId!,
        role_id: roleId,
        name: guestName.trim(),
        email: guestEmail.trim(),
        portfolio_link: guestPortfolio.trim() || null,
        message: guestMessage.trim() || null,
      } as any);
      if (error) throw error;

      // Notify via edge function (fire-and-forget, don't block success)
      const roleName = project?.roles?.find((r: any) => r.id === roleId)?.role_name || "Unknown Role";
      supabase.functions.invoke("notify-guest-application", {
        body: {
          project_id: projectId,
          project_title: project?.title,
          role_name: roleName,
          applicant_name: guestName.trim(),
          applicant_email: guestEmail.trim(),
          project_creator_id: project?.creator_id,
          portfolio_link: guestPortfolio.trim() || null,
          message: guestMessage.trim() || null,
        },
      }).catch(() => {});
    },
    onSuccess: () => {
      setShowSuccessDialog(true);
      setSelectedRoleId(null);
      setGuestName("");
      setGuestEmail("");
      setGuestPortfolio("");
      setGuestMessage("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit application");
    },
  });

  const shareUrl = buildShareUrl.project(projectId || '');

  const handleShare = async () => {
    await shareLink({
      title: project?.title,
      text: `Check out this project: ${project?.title}`,
      url: shareUrl,
    });
  };

  const handleCopy = async () => {
    await shareLink({ url: shareUrl });
  };

  const hasAppliedToRole = (roleId: string) =>
    myApplications.some((a: any) => a.role_id === roleId);

  const getApplicationStatus = (roleId: string) =>
    myApplications.find((a: any) => a.role_id === roleId)?.status;

  const handleApplyClick = (roleId: string) => {
    setSelectedRoleId(selectedRoleId === roleId ? null : roleId);
  };

  const handleSubmitApplication = () => {
    if (!selectedRoleId) return;
    if (user) {
      applyMutation.mutate({ roleId: selectedRoleId, message: applicationMessage });
    } else {
      if (!guestName.trim() || !guestEmail.trim()) {
        toast.error("Name and email are required");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
        toast.error("Please enter a valid email");
        return;
      }
      guestApplyMutation.mutate({ roleId: selectedRoleId });
    }
  };

  const isPending = applyMutation.isPending || guestApplyMutation.isPending;

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
  const isCreator = user?.id === project.creator_id;

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

      <div className="max-w-lg mx-auto px-4 -mt-12 relative z-10 pb-12 space-y-4">
        {/* Project Details Card */}
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

        {/* Apply for Roles Card */}
        {project.roles && project.roles.length > 0 && !isCreator && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border/50 shadow-lg bg-card/95 backdrop-blur-md">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-lg font-display font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Apply for a Role
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select a role below and submit your application.
                </p>

                <div className="space-y-2">
                  {project.roles.map((role: any) => {
                    const applied = user ? hasAppliedToRole(role.id) : false;
                    const appStatus = user ? getApplicationStatus(role.id) : undefined;
                    const isFull = role.is_locked || role.slots_filled >= role.slots_available;
                    const isSelected = selectedRoleId === role.id;

                    return (
                      <div key={role.id} className="space-y-2">
                        <button
                          type="button"
                          disabled={isFull || applied}
                          onClick={() => handleApplyClick(role.id)}
                          className={cn(
                            "w-full text-left rounded-lg border p-3 transition-all",
                            isFull
                              ? "border-border/30 opacity-50 cursor-not-allowed"
                              : applied
                              ? "border-primary/30 bg-primary/5 cursor-default"
                              : isSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                              : "border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2.5 h-2.5 rounded-full", isFull ? "bg-muted-foreground" : "bg-primary")} />
                              <span className={cn("font-medium text-sm", isFull && "line-through text-muted-foreground")}>
                                {role.role_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({role.slots_filled}/{role.slots_available})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-primary font-semibold text-sm">{formatCurrency(role.payout_amount)}</span>
                              {applied && (
                                <Badge className={cn("text-[10px]",
                                  appStatus === 'accepted' ? "bg-emerald-500/20 text-emerald-400" :
                                  appStatus === 'rejected' ? "bg-red-500/20 text-red-400" :
                                  "bg-amber-500/20 text-amber-400"
                                )}>
                                  {appStatus === 'accepted' ? 'Accepted' : appStatus === 'rejected' ? 'Rejected' : 'Applied'}
                                </Badge>
                              )}
                              {isFull && !applied && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                            </div>
                          </div>
                          {role.description && (
                            <p className="text-xs text-muted-foreground mt-1 ml-4.5">{role.description}</p>
                          )}
                        </button>

                        {/* Application form — inline */}
                        <AnimatePresence>
                          {isSelected && !applied && !isFull && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="pl-4 space-y-3 overflow-hidden"
                            >
                              {/* Guest fields (unauthenticated) */}
                              {!user && (
                                <>
                                  <div className="space-y-1.5">
                                    <Label htmlFor="guest-name" className="text-xs">Name *</Label>
                                    <Input
                                      id="guest-name"
                                      value={guestName}
                                      onChange={(e) => setGuestName(e.target.value)}
                                      placeholder="Your full name"
                                      className="text-sm h-9"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label htmlFor="guest-email" className="text-xs">Email *</Label>
                                    <Input
                                      id="guest-email"
                                      type="email"
                                      value={guestEmail}
                                      onChange={(e) => setGuestEmail(e.target.value)}
                                      placeholder="your@email.com"
                                      className="text-sm h-9"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label htmlFor="guest-portfolio" className="text-xs">Portfolio / Instagram / Website</Label>
                                    <Input
                                      id="guest-portfolio"
                                      value={guestPortfolio}
                                      onChange={(e) => setGuestPortfolio(e.target.value)}
                                      placeholder="https://your-portfolio.com"
                                      className="text-sm h-9"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label htmlFor="guest-message" className="text-xs">Short message (optional)</Label>
                                    <Textarea
                                      id="guest-message"
                                      value={guestMessage}
                                      onChange={(e) => setGuestMessage(e.target.value)}
                                      placeholder="Why are you a great fit for this role?"
                                      rows={3}
                                      className="text-sm"
                                    />
                                  </div>
                                </>
                              )}

                              {/* Authenticated message field */}
                              {user && (
                                <Textarea
                                  value={applicationMessage}
                                  onChange={(e) => setApplicationMessage(e.target.value)}
                                  placeholder="Why are you a great fit for this role? (optional)"
                                  rows={3}
                                  className="text-sm"
                                />
                              )}

                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleSubmitApplication}
                                  disabled={isPending}
                                  className="gap-1.5"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  {isPending ? "Submitting..." : "Submit Application"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedRoleId(null);
                                    setApplicationMessage("");
                                    setGuestName("");
                                    setGuestEmail("");
                                    setGuestPortfolio("");
                                    setGuestMessage("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4" />
            Share Project
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => setDetailOpen(true)}
          >
            <ChevronRight className="h-4 w-4" />
            View Full Details
          </Button>
        </motion.div>

        {/* Join Workspace (authenticated only) */}
        {user && !isCreator && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Button
              className="w-full gap-2"
              onClick={() => navigate(`/projects`)}
            >
              <ExternalLink className="h-4 w-4" />
              Join Workspace
            </Button>
          </motion.div>
        )}
      </div>

      {/* Guest success dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-center">Application Submitted!</DialogTitle>
            <DialogDescription className="text-center">
              Create your Ether profile to join the project workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              className="w-full gap-2"
              onClick={() => navigate(`/auth?redirect=${encodeURIComponent(`/project/${projectId}`)}`)}
            >
              <LogIn className="h-4 w-4" />
              Create Profile
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowSuccessDialog(false)}
            >
              Continue as Guest
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded ProjectDetail sheet */}
      <ProjectDetail
        project={detailOpen ? ({
          ...project,
          roles: project.roles || project.project_roles || [],
        } as Project) : null}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
