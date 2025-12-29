import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Folder, Plus, MoreHorizontal, Trash2, Edit, Camera, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { usePortfolioFolders, PortfolioFolder, CreateFolderInput } from '@/hooks/usePortfolioFolders';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  const [formData, setFormData] = useState<CreateFolderInput>({ name: '', description: '', cover_image_url: '' });
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `folder-covers/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, cover_image_url: publicUrl }));
      toast.success('Cover image uploaded!');
    } catch (error) {
      console.error('Error uploading cover:', error);
      toast.error('Failed to upload cover');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    await createFolder.mutateAsync(formData);
    setFormData({ name: '', description: '', cover_image_url: '' });
    setShowCreateDialog(false);
  };

  const handleUpdate = async () => {
    if (!editingFolder || !formData.name.trim()) return;
    await updateFolder.mutateAsync({ 
      id: editingFolder.id, 
      name: formData.name, 
      description: formData.description,
      cover_image_url: formData.cover_image_url || editingFolder.cover_image_url
    });
    setFormData({ name: '', description: '', cover_image_url: '' });
    setEditingFolder(null);
  };

  const handleDelete = async (folder: PortfolioFolder) => {
    if (confirm(`Delete "${folder.name}"? Posts inside will be unassigned.`)) {
      await deleteFolder.mutateAsync(folder.id);
    }
  };

  const openEditDialog = (folder: PortfolioFolder) => {
    setFormData({ 
      name: folder.name, 
      description: folder.description || '',
      cover_image_url: folder.cover_image_url || ''
    });
    setEditingFolder(folder);
  };

  if (isLoading) {
    return (
      <div className="px-5 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-medium text-foreground">Portfolio</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
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
            New
          </Button>
        )}
      </div>

      {folders.length === 0 && !isOwner ? (
        <div className="text-center py-10 text-muted-foreground">
          <Folder className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No portfolio folders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Vertical Scrolling Feed */}
          {folders.map((folder, index) => (
            <motion.div
              key={folder.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div
                className={cn(
                  "group relative flex items-center gap-4 p-3 rounded-xl cursor-pointer",
                  "bg-card/50 border border-border/50",
                  "hover:bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200"
                )}
                onClick={() => onFolderClick(folder)}
              >
                {/* Cover Image Thumbnail */}
                <div className={cn(
                  "relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0",
                  "bg-gradient-to-br from-muted/80 to-muted/40"
                )}>
                  {folder.cover_image_url ? (
                    <img
                      src={folder.cover_image_url}
                      alt={folder.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Folder className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* Folder Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">
                    {folder.name}
                  </h3>
                  {folder.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {folder.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {folder.post_count || 0} {folder.post_count === 1 ? 'item' : 'items'}
                  </p>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />

                {/* Owner Actions */}
                {isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
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
              </div>
            </motion.div>
          ))}

          {/* Add Folder Button - Only for owner */}
          {isOwner && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: folders.length * 0.05 }}
            >
              <button
                className={cn(
                  "w-full flex items-center justify-center gap-2 p-4 rounded-xl",
                  "border-2 border-dashed border-muted-foreground/20",
                  "text-muted-foreground hover:text-foreground",
                  "hover:border-primary/40 hover:bg-primary/5 transition-all"
                )}
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">Create New Folder</span>
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || !!editingFolder} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingFolder(null);
          setFormData({ name: '', description: '', cover_image_url: '' });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingFolder ? 'Edit Folder' : 'Create Portfolio Folder'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Cover Image Upload */}
            <div className="space-y-2">
              <Label>Cover Image</Label>
              <label className="block cursor-pointer">
                <div className={cn(
                  "relative aspect-[3/1] rounded-xl overflow-hidden",
                  "bg-gradient-to-br from-muted to-muted/50",
                  "border border-dashed border-border hover:border-primary/50 transition-colors"
                )}>
                  {formData.cover_image_url ? (
                    <img 
                      src={formData.cover_image_url} 
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <Camera className="w-6 h-6 mb-1" />
                      <span className="text-xs">Add cover image</span>
                    </div>
                  )}
                  {isUploadingCover && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleCoverUpload}
                  disabled={isUploadingCover}
                />
              </label>
            </div>

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
