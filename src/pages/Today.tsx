import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, isToday, isTomorrow, isPast, parseISO, addDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ArrowLeft, Sun, AlertCircle, Calendar, Circle, ChevronRight, Loader2, Plus, Search, Filter, Inbox, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import PageLayout from "@/components/layout/PageLayout";
import { useMyDayTasks, ContactTask } from "@/hooks/useContactTasks";
import { usePipeline } from "@/hooks/usePipeline";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { useAuth } from "@/contexts/AuthContext";

type TaskWithContact = ContactTask & {
  pipeline_items: { id: string; name: string; company: string | null; stage_id: string };
};

type FilterType = "all" | "today" | "overdue" | "upcoming" | "no-date";

const Today = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: tasks = [], isLoading } = useMyDayTasks();
  const { stages, items } = usePipeline();
  const queryClient = useQueryClient();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [showAddTask, setShowAddTask] = useState(false);
  
  // Add task form state
  const [selectedContact, setSelectedContact] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState<Date | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));

  // Get stage name by ID
  const getStageName = (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.name || "Unknown";
  };

  // Filter and search tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.pipeline_items.name.toLowerCase().includes(query) ||
        (t.pipeline_items.company?.toLowerCase().includes(query))
      );
    }

    // Apply filter
    if (filter !== "all") {
      result = result.filter(t => {
        if (!t.due_at) return filter === "no-date";
        const dueDate = parseISO(t.due_at);
        switch (filter) {
          case "today":
            return isWithinInterval(dueDate, { start: todayStart, end: todayEnd });
          case "overdue":
            return isPast(dueDate) && !isWithinInterval(dueDate, { start: todayStart, end: todayEnd });
          case "upcoming":
            return dueDate > todayEnd && dueDate <= weekEnd;
          default:
            return true;
        }
      });
    }

    return result;
  }, [tasks, searchQuery, filter, todayStart, todayEnd, weekEnd]);

  // Categorize tasks for display
  const categorizedTasks = useMemo(() => {
    const overdue: TaskWithContact[] = [];
    const today: TaskWithContact[] = [];
    const upcoming: TaskWithContact[] = [];
    const noDate: TaskWithContact[] = [];

    filteredTasks.forEach(t => {
      if (!t.due_at) {
        noDate.push(t);
        return;
      }
      const dueDate = parseISO(t.due_at);
      if (isPast(dueDate) && !isWithinInterval(dueDate, { start: todayStart, end: todayEnd })) {
        overdue.push(t);
      } else if (isWithinInterval(dueDate, { start: todayStart, end: todayEnd })) {
        today.push(t);
      } else if (dueDate > todayEnd && dueDate <= weekEnd) {
        upcoming.push(t);
      } else if (dueDate > weekEnd) {
        upcoming.push(t); // Include future tasks beyond 7 days in upcoming
      }
    });

    return { overdue, today, upcoming, noDate };
  }, [filteredTasks, todayStart, todayEnd, weekEnd]);

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
    navigate(`/pipeline?openContact=${pipelineItemId}`);
  };

  const formatDueDate = (dueAt: string) => {
    const date = parseISO(dueAt);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  const handleAddTask = async () => {
    if (!selectedContact || !taskTitle.trim() || !user) return;
    
    setIsCreating(true);
    try {
      const { error } = await supabase
        .from('contact_tasks')
        .insert({
          owner_user_id: user.id,
          pipeline_item_id: selectedContact,
          title: taskTitle.trim(),
          due_at: taskDueDate?.toISOString() || null,
        });
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['my-day-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['contact-tasks', selectedContact] });
      toast.success("Task added!");
      setShowAddTask(false);
      setSelectedContact("");
      setTaskTitle("");
      setTaskDueDate(undefined);
    } catch (err) {
      toast.error("Failed to add task");
    } finally {
      setIsCreating(false);
    }
  };

  const totalTasks = tasks.length;
  const hasNoTasks = totalTasks === 0;
  const hasNoFilteredTasks = filteredTasks.length === 0 && !hasNoTasks;

  return (
    <PageLayout hideNav>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
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
                {totalTasks > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {totalTasks}
                  </Badge>
                )}
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={() => setShowAddTask(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </Button>
          </div>

          {/* Search and Filter Bar */}
          {totalTasks > 0 && (
            <div className="flex items-center gap-2 px-4 pb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks or contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                    <Filter className="w-4 h-4" />
                    {filter === "all" ? "All" : filter === "today" ? "Today" : filter === "overdue" ? "Overdue" : filter === "upcoming" ? "Next 7 Days" : "No Date"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFilter("all")}>All Tasks</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter("today")}>Due Today</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter("overdue")}>Overdue</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter("upcoming")}>Next 7 Days</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter("no-date")}>No Due Date</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div className="p-4 space-y-6 max-w-2xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : hasNoTasks ? (
            <Card className="p-8 text-center bg-muted/20 border-border/50">
              <Sun className="w-12 h-12 text-amber-500/50 mx-auto mb-4" />
              <h2 className="text-lg font-medium mb-2">All caught up!</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Add a task to a contact to see it here.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button variant="outline" onClick={() => navigate('/pipeline')}>
                  Go to Pipeline
                </Button>
                <Button onClick={() => setShowAddTask(true)} className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  Add Task
                </Button>
              </div>
            </Card>
          ) : hasNoFilteredTasks ? (
            <Card className="p-8 text-center bg-muted/20 border-border/50">
              <Search className="w-10 h-10 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-lg font-medium mb-2">No matching tasks</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Try adjusting your search or filter.
              </p>
              <Button variant="outline" onClick={() => { setSearchQuery(""); setFilter("all"); }}>
                Clear Filters
              </Button>
            </Card>
          ) : (
            <>
              {/* Overdue Section */}
              {categorizedTasks.overdue.length > 0 && (
                <TaskSection
                  title="Overdue"
                  icon={<AlertCircle className="w-4 h-4 text-red-500" />}
                  tasks={categorizedTasks.overdue}
                  onToggle={handleToggle}
                  onNavigate={handleNavigateToContact}
                  formatDueDate={formatDueDate}
                  getStageName={getStageName}
                  isOverdue
                  togglingId={togglingId}
                />
              )}

              {/* Today Section */}
              {categorizedTasks.today.length > 0 && (
                <TaskSection
                  title="Today"
                  icon={<Sun className="w-4 h-4 text-amber-500" />}
                  tasks={categorizedTasks.today}
                  onToggle={handleToggle}
                  onNavigate={handleNavigateToContact}
                  formatDueDate={formatDueDate}
                  getStageName={getStageName}
                  togglingId={togglingId}
                />
              )}

              {/* Upcoming Section */}
              {categorizedTasks.upcoming.length > 0 && (
                <TaskSection
                  title="Next 7 Days"
                  icon={<Calendar className="w-4 h-4 text-blue-500" />}
                  tasks={categorizedTasks.upcoming}
                  onToggle={handleToggle}
                  onNavigate={handleNavigateToContact}
                  formatDueDate={formatDueDate}
                  getStageName={getStageName}
                  togglingId={togglingId}
                />
              )}

              {/* No Due Date Section */}
              {categorizedTasks.noDate.length > 0 && (
                <TaskSection
                  title="No Due Date"
                  icon={<Inbox className="w-4 h-4 text-muted-foreground" />}
                  tasks={categorizedTasks.noDate}
                  onToggle={handleToggle}
                  onNavigate={handleNavigateToContact}
                  formatDueDate={formatDueDate}
                  getStageName={getStageName}
                  togglingId={togglingId}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select value={selectedContact} onValueChange={setSelectedContact}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact..." />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} {item.company && `(${item.company})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Task</Label>
              <Input
                placeholder="What needs to be done?"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {taskDueDate ? format(taskDueDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={taskDueDate}
                    onSelect={setTaskDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddTask(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddTask} 
                disabled={!selectedContact || !taskTitle.trim() || isCreating}
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Task"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
  getStageName: (stageId: string) => string;
  isOverdue?: boolean;
  togglingId: string | null;
}

function TaskSection({ title, icon, tasks, onToggle, onNavigate, formatDueDate, getStageName, isOverdue, togglingId }: TaskSectionProps) {
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
            className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors group cursor-pointer"
            onClick={() => onNavigate(task.pipeline_items.id)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(task);
              }}
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span className="truncate">{task.pipeline_items.name}</span>
                {task.pipeline_items.company && (
                  <>
                    <span>•</span>
                    <span className="truncate">{task.pipeline_items.company}</span>
                  </>
                )}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {getStageName(task.pipeline_items.stage_id)}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {task.due_at && (
                <span className={cn(
                  "text-xs flex items-center gap-1",
                  isOverdue ? "text-red-500" : "text-muted-foreground"
                )}>
                  <Clock className="w-3 h-3" />
                  {formatDueDate(task.due_at)}
                </span>
              )}
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export default Today;