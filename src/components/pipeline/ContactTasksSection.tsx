import { useState } from "react";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { CheckCircle2, Circle, Plus, Trash2, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { useContactTasks, ContactTask } from "@/hooks/useContactTasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ContactTasksSectionProps {
  pipelineItemId: string;
}

export function ContactTasksSection({ pipelineItemId }: ContactTasksSectionProps) {
  const { tasks, isLoading, createTask, toggleTask, deleteTask, isCreating } = useContactTasks(pipelineItemId);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    
    try {
      await createTask({
        title: newTaskTitle.trim(),
        dueAt: newTaskDueDate?.toISOString(),
      });
      setNewTaskTitle("");
      setNewTaskDueDate(undefined);
      toast.success("Task added");
    } catch (err) {
      toast.error("Failed to add task");
    }
  };

  const handleToggle = async (task: ContactTask) => {
    try {
      await toggleTask({ taskId: task.id, isDone: !task.is_done });
    } catch (err) {
      toast.error("Failed to update task");
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast.success("Task deleted");
    } catch (err) {
      toast.error("Failed to delete task");
    }
  };

  const formatDueDate = (dueAt: string) => {
    const date = parseISO(dueAt);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  const isOverdue = (dueAt: string | null, isDone: boolean) => {
    if (!dueAt || isDone) return false;
    return isPast(parseISO(dueAt)) && !isToday(parseISO(dueAt));
  };

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-sm text-foreground flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
        Tasks
      </h3>

      {/* Add task input */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          className="h-9 text-sm"
        />
        <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-9 w-9 shrink-0",
                newTaskDueDate && "text-primary border-primary"
              )}
            >
              <Calendar className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarPicker
              mode="single"
              selected={newTaskDueDate}
              onSelect={(date) => {
                setNewTaskDueDate(date);
                setShowDatePicker(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleAddTask}
          disabled={!newTaskTitle.trim() || isCreating}
        >
          {isCreating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Due date preview */}
      {newTaskDueDate && (
        <p className="text-xs text-muted-foreground">
          Due: {format(newTaskDueDate, "EEEE, MMMM d")}
          <button
            onClick={() => setNewTaskDueDate(undefined)}
            className="ml-2 text-primary hover:underline"
          >
            Clear
          </button>
        </p>
      )}

      {/* Task list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No tasks yet</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-2 group p-2 rounded-lg hover:bg-muted/50 transition-colors",
                task.is_done && "opacity-60"
              )}
            >
              <button
                onClick={() => handleToggle(task)}
                className="shrink-0"
              >
                {task.is_done ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm truncate",
                  task.is_done && "line-through text-muted-foreground"
                )}>
                  {task.title}
                </p>
                {task.due_at && (
                  <p className={cn(
                    "text-xs",
                    isOverdue(task.due_at, task.is_done)
                      ? "text-red-500"
                      : "text-muted-foreground"
                  )}>
                    {formatDueDate(task.due_at)}
                    {isOverdue(task.due_at, task.is_done) && " (overdue)"}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(task.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
