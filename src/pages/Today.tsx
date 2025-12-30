import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isTomorrow, isPast, parseISO, addDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ArrowLeft, Sun, AlertCircle, Calendar, CheckCircle2, Circle, ChevronRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PageLayout from "@/components/layout/PageLayout";
import { useMyDayTasks, ContactTask } from "@/hooks/useContactTasks";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TaskWithContact = ContactTask & {
  pipeline_items: { id: string; name: string; company: string | null };
};

const Today = () => {
  const navigate = useNavigate();
  const { data: tasks = [], isLoading } = useMyDayTasks();
  const queryClient = useQueryClient();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));

  // Categorize tasks
  const overdueTasks = tasks.filter(t => {
    if (!t.due_at) return false;
    const dueDate = parseISO(t.due_at);
    return isPast(dueDate) && !isWithinInterval(dueDate, { start: todayStart, end: todayEnd });
  });

  const todayTasks = tasks.filter(t => {
    if (!t.due_at) return false;
    const dueDate = parseISO(t.due_at);
    return isWithinInterval(dueDate, { start: todayStart, end: todayEnd });
  });

  const upcomingTasks = tasks.filter(t => {
    if (!t.due_at) return false;
    const dueDate = parseISO(t.due_at);
    return dueDate > todayEnd && dueDate <= weekEnd;
  });

  const handleToggle = async (task: TaskWithContact) => {
    setTogglingId(task.id);
    try {
      const { error } = await supabase
        .from('contact_tasks')
        .update({ is_done: true })
        .eq('id', task.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['my-day-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['contact-tasks'] });
      toast.success("Task completed!");
    } catch (err) {
      toast.error("Failed to complete task");
    } finally {
      setTogglingId(null);
    }
  };

  const handleNavigateToContact = (pipelineItemId: string) => {
    // Navigate to pipeline and let it handle opening the contact
    navigate(`/pipeline?openContact=${pipelineItemId}`);
  };

  const formatDueDate = (dueAt: string) => {
    const date = parseISO(dueAt);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  return (
    <PageLayout hideNav>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-amber-500" />
              <h1 className="font-display text-xl font-semibold text-foreground">My Day</h1>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6 max-w-2xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <Card className="p-8 text-center bg-muted/20 border-border/50">
              <Sun className="w-12 h-12 text-amber-500/50 mx-auto mb-4" />
              <h2 className="text-lg font-medium mb-2">All caught up!</h2>
              <p className="text-muted-foreground text-sm mb-4">
                No tasks due. Add tasks in your pipeline contacts.
              </p>
              <Button variant="outline" onClick={() => navigate('/pipeline')}>
                Go to Pipeline
              </Button>
            </Card>
          ) : (
            <>
              {/* Overdue Section */}
              {overdueTasks.length > 0 && (
                <TaskSection
                  title="Overdue"
                  icon={<AlertCircle className="w-4 h-4 text-red-500" />}
                  tasks={overdueTasks}
                  onToggle={handleToggle}
                  onNavigate={handleNavigateToContact}
                  formatDueDate={formatDueDate}
                  isOverdue
                  togglingId={togglingId}
                />
              )}

              {/* Today Section */}
              {todayTasks.length > 0 && (
                <TaskSection
                  title="Today"
                  icon={<Sun className="w-4 h-4 text-amber-500" />}
                  tasks={todayTasks}
                  onToggle={handleToggle}
                  onNavigate={handleNavigateToContact}
                  formatDueDate={formatDueDate}
                  togglingId={togglingId}
                />
              )}

              {/* Upcoming Section */}
              {upcomingTasks.length > 0 && (
                <TaskSection
                  title="Next 7 Days"
                  icon={<Calendar className="w-4 h-4 text-blue-500" />}
                  tasks={upcomingTasks}
                  onToggle={handleToggle}
                  onNavigate={handleNavigateToContact}
                  formatDueDate={formatDueDate}
                  togglingId={togglingId}
                />
              )}
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

interface TaskSectionProps {
  title: string;
  icon: React.ReactNode;
  tasks: TaskWithContact[];
  onToggle: (task: TaskWithContact) => void;
  onNavigate: (pipelineItemId: string) => void;
  formatDueDate: (dueAt: string) => string;
  isOverdue?: boolean;
  togglingId: string | null;
}

function TaskSection({ title, icon, tasks, onToggle, onNavigate, formatDueDate, isOverdue, togglingId }: TaskSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="font-medium text-sm text-foreground">{title}</h2>
        <Badge variant="secondary" className="text-xs">
          {tasks.length}
        </Badge>
      </div>

      <Card className="bg-muted/20 border-border/50 divide-y divide-border/30 overflow-hidden">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors group"
          >
            <button
              onClick={() => onToggle(task)}
              className="shrink-0"
              disabled={togglingId === task.id}
            >
              {togglingId === task.id ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
              )}
            </button>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{task.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate">{task.pipeline_items.name}</span>
                {task.pipeline_items.company && (
                  <>
                    <span>•</span>
                    <span className="truncate">{task.pipeline_items.company}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {task.due_at && (
                <span className={cn(
                  "text-xs",
                  isOverdue ? "text-red-500" : "text-muted-foreground"
                )}>
                  {formatDueDate(task.due_at)}
                </span>
              )}
              <button
                onClick={() => onNavigate(task.pipeline_items.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-primary"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export default Today;
