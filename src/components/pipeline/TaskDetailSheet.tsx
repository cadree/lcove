import { useState } from "react";
import { format, parseISO } from "date-fns";
import { FileDown, Pencil, Calendar, X, Save, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ContactTask } from "@/hooks/useContactTasks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";

interface TaskDetailSheetProps {
  task: ContactTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (taskId: string, title: string, dueAt: string | null) => Promise<void>;
  contactName?: string;
}

export function TaskDetailSheet({ 
  task, 
  open, 
  onOpenChange, 
  onUpdate,
  contactName 
}: TaskDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = () => {
    if (!task) return;
    setEditTitle(task.title);
    setEditDueDate(task.due_at ? parseISO(task.due_at) : undefined);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle("");
    setEditDueDate(undefined);
  };

  const handleSave = async () => {
    if (!task || !editTitle.trim()) {
      handleCancelEdit();
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(task.id, editTitle.trim(), editDueDate?.toISOString() || null);
      setIsEditing(false);
      toast.success("Task updated");
    } catch {
      toast.error("Failed to update task");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = () => {
    if (!task) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPosition = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Task Details", margin, yPosition);
    yPosition += 15;

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Contact name if available
    if (contactName) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Contact:", margin, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(contactName, margin + 25, yPosition);
      yPosition += 10;
    }

    // Status
    doc.setFont("helvetica", "bold");
    doc.text("Status:", margin, yPosition);
    doc.setFont("helvetica", "normal");
    doc.text(task.is_done ? "Completed" : "Pending", margin + 25, yPosition);
    yPosition += 10;

    // Due date
    if (task.due_at) {
      doc.setFont("helvetica", "bold");
      doc.text("Due Date:", margin, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(format(parseISO(task.due_at), "MMMM d, yyyy"), margin + 30, yPosition);
      yPosition += 10;
    }

    // Created date
    doc.setFont("helvetica", "bold");
    doc.text("Created:", margin, yPosition);
    doc.setFont("helvetica", "normal");
    doc.text(format(parseISO(task.created_at), "MMMM d, yyyy 'at' h:mm a"), margin + 30, yPosition);
    yPosition += 10;

    // Completed date if done
    if (task.is_done && task.completed_at) {
      doc.setFont("helvetica", "bold");
      doc.text("Completed:", margin, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(format(parseISO(task.completed_at), "MMMM d, yyyy 'at' h:mm a"), margin + 35, yPosition);
      yPosition += 10;
    }

    yPosition += 5;
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Task content
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Task Description:", margin, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    
    // Split text for wrapping
    const splitText = doc.splitTextToSize(task.title, contentWidth);
    doc.text(splitText, margin, yPosition);

    // Save with filename
    const filename = `task-${task.id.slice(0, 8)}.pdf`;
    doc.save(filename);
    toast.success("Task exported to PDF");
  };

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader className="space-y-0 pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Task Details</SheetTitle>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEdit}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportPDF}
                  >
                    <FileDown className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-1" />
                    )}
                    Save
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2 py-1 text-xs font-medium rounded-full",
              task.is_done 
                ? "bg-primary/10 text-primary" 
                : "bg-muted text-muted-foreground"
            )}>
              {task.is_done ? "Completed" : "Pending"}
            </span>
            {contactName && (
              <span className="text-xs text-muted-foreground">
                for {contactName}
              </span>
            )}
          </div>

          {/* Due date */}
          {isEditing ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Due Date</label>
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editDueDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {editDueDate ? format(editDueDate, "MMMM d, yyyy") : "No due date"}
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
          ) : task.due_at ? (
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Due Date</label>
              <p className="text-sm">{format(parseISO(task.due_at), "EEEE, MMMM d, yyyy")}</p>
            </div>
          ) : null}

          {/* Task content */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Task Description</label>
            {isEditing ? (
              <Textarea
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter task description..."
                className="min-h-[200px] text-base"
              />
            ) : (
              <div className="p-4 bg-muted/50 rounded-lg min-h-[200px]">
                <p className="text-sm whitespace-pre-wrap break-words">{task.title}</p>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-border/50 space-y-2 text-xs text-muted-foreground">
            <p>Created: {format(parseISO(task.created_at), "MMMM d, yyyy 'at' h:mm a")}</p>
            {task.is_done && task.completed_at && (
              <p>Completed: {format(parseISO(task.completed_at), "MMMM d, yyyy 'at' h:mm a")}</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
