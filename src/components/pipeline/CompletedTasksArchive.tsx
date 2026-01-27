import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Archive, RotateCcw, Trash2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ContactTask } from "@/hooks/useContactTasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CompletedTasksArchiveProps {
  archivedTasks: ContactTask[];
  onRestore: (taskId: string) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  isLoading?: boolean;
  trigger?: React.ReactNode;
}

export function CompletedTasksArchive({ 
  archivedTasks, 
  onRestore, 
  onDelete, 
  onClearAll,
  isLoading,
  trigger 
}: CompletedTasksArchiveProps) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Group tasks by completion date
  const groupedByDate = archivedTasks.reduce((acc, task) => {
    const dateKey = task.archived_at 
      ? format(parseISO(task.archived_at), 'yyyy-MM-dd')
      : task.completed_at 
        ? format(parseISO(task.completed_at), 'yyyy-MM-dd')
        : 'Unknown';
    
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(task);
    return acc;
  }, {} as Record<string, ContactTask[]>);

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const toggleDate = (date: string) => {
    const next = new Set(expandedDates);
    if (next.has(date)) {
      next.delete(date);
    } else {
      next.add(date);
    }
    setExpandedDates(next);
  };

  const handleRestore = async (taskId: string) => {
    setRestoringId(taskId);
    try {
      await onRestore(taskId);
      toast.success("Task restored");
    } catch {
      toast.error("Failed to restore task");
    } finally {
      setRestoringId(null);
    }
  };

  const handleDelete = async (taskId: string) => {
    setDeletingId(taskId);
    try {
      await onDelete(taskId);
      toast.success("Task deleted permanently");
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    try {
      await onClearAll();
      toast.success("All archived tasks cleared");
    } catch {
      toast.error("Failed to clear tasks");
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
            <Archive className="w-3 h-3" />
            Archive ({archivedTasks.length})
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Completed Tasks Archive
          </SheetTitle>
          {archivedTasks.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all archived tasks?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {archivedTasks.length} archived tasks. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground">
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : archivedTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No archived tasks</p>
              <p className="text-xs mt-1">Completed tasks will appear here when archived</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDates.map((dateKey) => {
                const tasks = groupedByDate[dateKey];
                const isExpanded = expandedDates.has(dateKey);
                const displayDate = dateKey === 'Unknown' 
                  ? 'Unknown Date' 
                  : format(parseISO(dateKey), 'EEEE, MMMM d, yyyy');

                return (
                  <Collapsible key={dateKey} open={isExpanded}>
                    <CollapsibleTrigger 
                      onClick={() => toggleDate(dateKey)}
                      className="flex items-center justify-between w-full py-2 px-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm font-medium">{displayDate}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{tasks.length} tasks</span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-1">
                      {tasks.map((task) => (
                        <div 
                          key={task.id}
                          className="flex items-center gap-2 py-2 px-3 bg-muted/20 rounded-lg group"
                        >
                          <span className="flex-1 text-sm text-muted-foreground line-through truncate">
                            {task.title}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRestore(task.id)}
                            disabled={restoringId === task.id}
                          >
                            {restoringId === task.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                            onClick={() => handleDelete(task.id)}
                            disabled={deletingId === task.id}
                          >
                            {deletingId === task.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
