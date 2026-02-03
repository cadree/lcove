import { useState, useRef, useEffect } from "react";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { CheckCircle2, Circle, Plus, Trash2, Calendar, Loader2, Pencil, Archive, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useContactTasks, ContactTask } from "@/hooks/useContactTasks";
import { TaskVisualizerSheet } from "./TaskVisualizerSheet";
import { CompletedTasksArchive } from "./CompletedTasksArchive";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ContactTasksSectionProps {
  pipelineItemId: string;
}

interface EditableTaskProps {
  task: ContactTask;
  onToggle: (task: ContactTask) => void;
  onUpdate: (taskId: string, title: string, dueAt: string | null) => Promise<void>;
  onDelete: (taskId: string) => void;
  onView: (task: ContactTask) => void;
}

function EditableTask({ task, onToggle, onUpdate, onDelete, onView }: EditableTaskProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDueDate, setEditDueDate] = useState<Date | undefined>(
    task.due_at ? parseISO(task.due_at) : undefined
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

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

  const handleSave = async () => {
    if (!editTitle.trim()) {
      setEditTitle(task.title);
      setIsEditing(false);
      return;
    }

    const hasChanges = editTitle !== task.title || 
      (editDueDate?.toISOString() || null) !== task.due_at;

    if (!hasChanges) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(task.id, editTitle.trim(), editDueDate?.toISOString() || null);
      setIsEditing(false);
    } catch {
      toast.error("Failed to update task");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditTitle(task.title);
      setEditDueDate(task.due_at ? parseISO(task.due_at) : undefined);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 p-2 bg-muted/50 rounded-lg">
        <Input
          ref={inputRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-8 text-sm"
          disabled={isSaving}
        />
        <div className="flex items-center gap-2">
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-7 text-xs",
                  editDueDate && "text-primary border-primary"
                )}
              >
                <Calendar className="w-3 h-3 mr-1" />
                {editDueDate ? format(editDueDate, "MMM d") : "Add date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={editDueDate}
                onSelect={(date) => {
                  setEditDueDate(date);
                  setShowDatePicker(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {editDueDate && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setEditDueDate(undefined)}
            >
              Clear date
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 group p-2 rounded-lg hover:bg-muted/50 transition-colors",
        task.is_done && "opacity-60"
      )}
    >
      <button
        onClick={() => onToggle(task)}
        className="shrink-0"
      >
        {task.is_done ? (
          <CheckCircle2 className="w-5 h-5 text-primary" />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
        )}
      </button>
      <div 
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onView(task)}
      >
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
              ? "text-destructive"
              : "text-muted-foreground"
          )}>
            {formatDueDate(task.due_at)}
            {isOverdue(task.due_at, task.is_done) && " (overdue)"}
          </p>
        )}
      </div>
      <div className="flex items-center shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView(task);
          }}
          className="p-1.5 hover:text-primary touch-manipulation"
          aria-label="View full task"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="p-1.5 hover:text-primary touch-manipulation"
          aria-label="Quick edit task"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="p-1.5 hover:text-destructive touch-manipulation"
          aria-label="Delete task"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function ContactTasksSection({ pipelineItemId }: ContactTasksSectionProps) {
  const { 
    incompleteTasks, 
    completedTasks, 
    archivedTasks,
    isLoading, 
    isLoadingArchived,
    createTask, 
    updateTask,
    toggleTask, 
    deleteTask, 
    archiveCompletedTasks,
    restoreTask,
    clearCompletedTasks,
    clearArchivedTasks,
    isCreating,
    isArchiving,
  } = useContactTasks(pipelineItemId);
  
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ContactTask | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);

  const handleViewTask = (task: ContactTask) => {
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

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

  const handleUpdate = async (taskId: string, title: string, dueAt: string | null) => {
    await updateTask({ taskId, title, dueAt });
    toast.success("Task updated");
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast.success("Task deleted");
    } catch (err) {
      toast.error("Failed to delete task");
    }
  };

  const handleArchiveCompleted = async () => {
    try {
      await archiveCompletedTasks();
      toast.success("Completed tasks archived");
    } catch {
      toast.error("Failed to archive tasks");
    }
  };

  const handleClearCompleted = async () => {
    try {
      await clearCompletedTasks();
      toast.success("Completed tasks cleared");
    } catch {
      toast.error("Failed to clear tasks");
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm text-foreground flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
          Tasks
        </h3>
        <div className="flex items-center gap-1">
          <TaskVisualizerSheet />
          {archivedTasks.length > 0 && (
            <CompletedTasksArchive
              archivedTasks={archivedTasks}
              onRestore={restoreTask}
              onDelete={deleteTask}
              onClearAll={clearArchivedTasks}
              isLoading={isLoadingArchived}
            />
          )}
        </div>
      </div>

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
      ) : incompleteTasks.length === 0 && completedTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No tasks yet</p>
      ) : (
        <div className="space-y-2">
          {/* Incomplete tasks */}
          {incompleteTasks.map((task) => (
            <EditableTask
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onView={handleViewTask}
            />
          ))}

          {/* Completed tasks section */}
          {completedTasks.length > 0 && (
            <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {showCompleted ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  Completed ({completedTasks.length})
                </CollapsibleTrigger>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={handleArchiveCompleted}
                    disabled={isArchiving}
                  >
                    {isArchiving ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Archive className="w-3 h-3 mr-1" />
                        Archive
                      </>
                    )}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Clear
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Clear completed tasks?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete {completedTasks.length} completed tasks. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearCompleted} className="bg-destructive text-destructive-foreground">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <CollapsibleContent className="space-y-1 pt-1">
                {completedTasks.map((task) => (
                  <EditableTask
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onView={handleViewTask}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={selectedTask}
        open={showTaskDetail}
        onOpenChange={(open) => {
          setShowTaskDetail(open);
          if (!open) setSelectedTask(null);
        }}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
