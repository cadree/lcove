import { useState } from 'react';
import { motion } from 'framer-motion';
import { Folder, Plus, Image as ImageIcon, Play, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { usePortfolioFolders, PortfolioFolder, CreateFolderInput } from '@/hooks/usePortfolioFolders';
import { cn } from '@/lib/utils';

interface ProfileFoldersProps {
  userId: string;
  isOwner: boolean;
  onFolderClick: (folder: PortfolioFolder) => void;
}

export function ProfileFolders({ userId, isOwner, onFolderClick }: ProfileFoldersProps) {
  const { folders, isLoading, createFolder, deleteFolder, updateFolder } = usePortfolioFolders(userId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<PortfolioFolder | null>(null);
  const [formData, setFormData] = useState<CreateFolderInput>({ name: '', description: '' });

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    await createFolder.mutateAsync(formData);
    setFormData({ name: '', description: '' });
    setShowCreateDialog(false);
  };

  const handleUpdate = async () => {
    if (!editingFolder || !formData.name.trim()) return;
    await updateFolder.mutateAsync({ id: editingFolder.id, name: formData.name, description: formData.description });
    setFormData({ name: '', description: '' });
    setEditingFolder(null);
  };

  const handleDelete = async (folder: PortfolioFolder) => {
    if (confirm(`Delete "${folder.name}"? Posts inside will be unassigned.`)) {
      await deleteFolder.mutateAsync(folder.id);
    }
  };

  const openEditDialog = (folder: PortfolioFolder) => {
    setFormData({ name: folder.name, description: folder.description || '' });
    setEditingFolder(folder);
  };

  if (isLoading) {
    return (
      <div className="px-5 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-medium text-foreground">Portfolio</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-[4/3] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-medium text-foreground">Portfolio</h2>
        {isOwner && (
          <Button variant="ghost" size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New Folder
          </Button>
        )}
      </div>

      {folders.length === 0 && !isOwner ? (
        <div className="text-center py-10 text-muted-foreground">
          <Folder className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No portfolio folders yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {folders.map((folder, index) => (
            <motion.div
              key={folder.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={cn(
                  "group relative aspect-[4/3] overflow-hidden cursor-pointer",
                  "bg-gradient-to-br from-muted/80 to-muted/40",
                  "border-border/50 hover:border-primary/30 transition-all duration-300",
                  "hover:shadow-lg hover:shadow-primary/5"
                )}
                onClick={() => onFolderClick(folder)}
              >
                {/* Cover Image or Placeholder */}
                {folder.cover_image_url ? (
                  <img
                    src={folder.cover_image_url}
                    alt={folder.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Folder className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="font-medium text-foreground text-sm truncate">
                    {folder.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {folder.post_count || 0} items
                  </p>
                </div>

                {/* Owner Actions */}
                {isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity bg-background/60 backdrop-blur-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(folder); }}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); handleDelete(folder); }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </Card>
            </motion.div>
          ))}

          {/* Add Folder Card - Only for owner */}
          {isOwner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: folders.length * 0.05 }}
            >
              <Card
                className={cn(
                  "aspect-[4/3] flex items-center justify-center cursor-pointer",
                  "border-dashed border-2 border-muted-foreground/20",
                  "hover:border-primary/40 hover:bg-primary/5 transition-all"
                )}
                onClick={() => setShowCreateDialog(true)}
              >
                <div className="text-center">
                  <Plus className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">Add Folder</p>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || !!editingFolder} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingFolder(null);
          setFormData({ name: '', description: '' });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingFolder ? 'Edit Folder' : 'Create Portfolio Folder'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Folder Name</Label>
              <Input
                id="name"
                placeholder="e.g., DJ Sets, Acting, Photography"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What kind of work goes in this folder?"
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setShowCreateDialog(false); setEditingFolder(null); }}
            >
              Cancel
            </Button>
            <Button 
              onClick={editingFolder ? handleUpdate : handleCreate}
              disabled={!formData.name.trim() || createFolder.isPending || updateFolder.isPending}
            >
              {editingFolder ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
