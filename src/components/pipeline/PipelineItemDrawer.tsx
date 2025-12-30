import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileText, Clock, ArrowRight, PlusCircle, StickyNote, Trash2, Save, Loader2, MoveRight } from "lucide-react";
import { PipelineItem, PipelineEvent, PipelineStage } from "@/actions/pipelineActions";
import { toast } from "sonner";

interface PipelineItemDrawerProps {
  item: PipelineItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getEventsForItem: (itemId: string) => PipelineEvent[];
  stages: PipelineStage[];
  onUpdate: (itemId: string, fields: { title?: string; subtitle?: string; notes?: string }) => Promise<void>;
  onMove: (itemId: string, toStageId: string) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  isMoving: boolean;
}

export function PipelineItemDrawer({ 
  item, 
  open, 
  onOpenChange, 
  getEventsForItem,
  stages,
  onUpdate,
  onMove,
  onDelete,
  isMoving
}: PipelineItemDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Reset edit state when item changes
  useEffect(() => {
    if (item) {
      setEditTitle(item.title);
      setEditSubtitle(item.subtitle || "");
      setEditNotes(item.notes || "");
      setIsEditing(false);
    }
  }, [item?.id]);

  if (!item) return null;

  const events = getEventsForItem(item.id);

  const handleSave = async () => {
    if (!editTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(item.id, {
        title: editTitle.trim(),
        subtitle: editSubtitle.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      setIsEditing(false);
      toast.success("Item updated");
    } catch (error) {
      toast.error("Failed to update item");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(item.id);
      toast.success("Item deleted");
    } catch (error) {
      toast.error("Failed to delete item");
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(item.title);
    setEditSubtitle(item.subtitle || "");
    setEditNotes(item.notes || "");
    setIsEditing(false);
  };

  const handleStageChange = async (newStageId: string) => {
    if (newStageId === item.stage_id) return;
    try {
      await onMove(item.id, newStageId);
      toast.success("Item moved");
    } catch (error) {
      toast.error("Failed to move item");
    }
  };

  const currentStage = stages.find(s => s.id === item.stage_id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="pb-4">
          {/* Move to Stage Selector */}
          <div className="flex items-center gap-2 mb-3">
            <MoveRight className="w-4 h-4 text-muted-foreground" />
            <Select 
              value={item.stage_id} 
              onValueChange={handleStageChange}
              disabled={isMoving}
            >
              <SelectTrigger className="w-full h-8 text-sm">
                <SelectValue placeholder="Move to stage..." />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      {stage.color && (
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                      )}
                      <span>{stage.name}</span>
                      {stage.id === item.stage_id && (
                        <span className="text-muted-foreground text-xs">(current)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="edit-title" className="text-xs">Title</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-subtitle" className="text-xs">Subtitle</Label>
                <Input
                  id="edit-subtitle"
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  placeholder="Subtitle (optional)"
                />
              </div>
            </div>
          ) : (
            <>
              <SheetTitle className="text-left text-xl">{item.title}</SheetTitle>
              {item.subtitle && (
                <p className="text-muted-foreground text-sm text-left">{item.subtitle}</p>
              )}
            </>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-260px)] pr-4">
          {/* Notes Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium text-sm text-foreground">Notes</h3>
            </div>
            {isEditing ? (
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes about this item..."
                className="min-h-[120px]"
              />
            ) : (
              <div 
                className="bg-muted/30 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap min-h-[60px] cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setIsEditing(true)}
              >
                {item.notes || <span className="text-muted-foreground italic">Click to add notes...</span>}
              </div>
            )}
          </div>

          <Separator className="my-4" />

          {/* Timeline Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-medium text-sm text-foreground">Activity Timeline</h3>
            </div>

            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <TimelineEvent key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>

          {/* Created At */}
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Created {format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-border flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)} className="flex-1">
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon" disabled={isDeleting}>
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete item?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{item.title}" and all its activity history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface TimelineEventProps {
  event: PipelineEvent;
}

function TimelineEvent({ event }: TimelineEventProps) {
  const getEventIcon = () => {
    switch (event.type) {
      case 'created':
        return <PlusCircle className="w-4 h-4 text-green-500" />;
      case 'stage_changed':
        return <ArrowRight className="w-4 h-4 text-blue-500" />;
      case 'note_added':
        return <StickyNote className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getEventLabel = () => {
    switch (event.type) {
      case 'created':
        return 'Item created';
      case 'stage_changed':
        return 'Moved to new stage';
      case 'note_added':
        return 'Note added';
      default:
        return event.type;
    }
  };

  const getEventBadgeVariant = (): "default" | "secondary" | "outline" => {
    switch (event.type) {
      case 'created':
        return 'default';
      case 'stage_changed':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 mt-0.5">
        {getEventIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={getEventBadgeVariant()} className="text-xs">
            {getEventLabel()}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format(new Date(event.created_at), "MMM d, h:mm a")}
          </span>
        </div>
        {event.type === 'note_added' && event.data?.note && (
          <p className="text-sm text-muted-foreground mt-1 truncate">
            "{String(event.data.note)}"
          </p>
        )}
      </div>
    </div>
  );
}
