import { useState } from "react";
import { ChevronDown, Plus, Settings, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pipeline, usePipelines } from "@/hooks/usePipelines";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface PipelineSelectorProps {
  currentPipeline: Pipeline | null;
  onPipelineChange: (pipeline: Pipeline) => void;
}

export function PipelineSelector({ currentPipeline, onPipelineChange }: PipelineSelectorProps) {
  const { pipelines, createPipeline, updatePipeline, deletePipeline, isCreating } = usePipelines();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    try {
      const pipeline = await createPipeline({ name: newName.trim() });
      onPipelineChange(pipeline);
      setShowCreateDialog(false);
      setNewName("");
      toast.success("Pipeline created");
    } catch (error) {
      toast.error("Failed to create pipeline");
    }
  };

  const handleEdit = async () => {
    if (!editingPipeline || !editName.trim()) return;
    
    try {
      await updatePipeline({ pipelineId: editingPipeline.id, name: editName.trim() });
      setShowEditDialog(false);
      setEditingPipeline(null);
      setEditName("");
      toast.success("Pipeline renamed");
    } catch (error) {
      toast.error("Failed to rename pipeline");
    }
  };

  const handleDelete = async (pipeline: Pipeline) => {
    if (pipelines.length <= 1) {
      toast.error("You must have at least one pipeline");
      return;
    }
    
    try {
      await deletePipeline(pipeline.id);
      if (currentPipeline?.id === pipeline.id && pipelines.length > 1) {
        const remaining = pipelines.find(p => p.id !== pipeline.id);
        if (remaining) onPipelineChange(remaining);
      }
      toast.success("Pipeline deleted");
    } catch (error) {
      toast.error("Failed to delete pipeline");
    }
  };

  const openEditDialog = (pipeline: Pipeline) => {
    setEditingPipeline(pipeline);
    setEditName(pipeline.name);
    setShowEditDialog(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 font-display text-xl font-semibold px-2">
            {currentPipeline?.name || "Pipeline"}
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {pipelines.map((pipeline) => (
            <DropdownMenuItem
              key={pipeline.id}
              className="flex items-center justify-between group"
              onClick={() => onPipelineChange(pipeline)}
            >
              <span className="flex items-center gap-2">
                {currentPipeline?.id === pipeline.id && (
                  <Check className="w-4 h-4 text-primary" />
                )}
                <span className={currentPipeline?.id !== pipeline.id ? "ml-6" : ""}>
                  {pipeline.name}
                </span>
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditDialog(pipeline);
                  }}
                >
                  <Settings className="w-3 h-3" />
                </Button>
                {pipelines.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(pipeline);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Pipeline
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Pipeline Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pipeline-name">Pipeline Name</Label>
              <Input
                id="pipeline-name"
                placeholder="e.g., Music Clients, Brand Deals, etc."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pipeline Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-pipeline-name">Pipeline Name</Label>
              <Input
                id="edit-pipeline-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!editName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
