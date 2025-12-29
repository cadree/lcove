import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, ImageIcon, Camera, Play, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PortfolioFolder, useFolderPosts, usePortfolioFolders } from '@/hooks/usePortfolioFolders';
import { useProfilePosts } from '@/hooks/useProfilePosts';
import { ProfilePost } from '@/types/post';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FolderDetailViewProps {
  folder: PortfolioFolder;
  userId: string;
  isOwner: boolean;
  onBack: () => void;
  onPostClick: (post: ProfilePost) => void;
}

export function FolderDetailView({ folder, userId, isOwner, onBack, onPostClick }: FolderDetailViewProps) {
  const { data: folderPosts, isLoading } = useFolderPosts(folder.id, userId);
  const { posts: allPosts } = useProfilePosts(userId);
  const { updateFolder, assignPostToFolder } = usePortfolioFolders(userId);
  const [showAddPostsDialog, setShowAddPostsDialog] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Filter posts that aren't already in this folder
  const availablePosts = allPosts.filter(
    post => post.media_url && post.folder_id !== folder.id
  );

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `folder-covers/${folder.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      await updateFolder.mutateAsync({ id: folder.id, cover_image_url: publicUrl });
      toast.success('Cover updated!');
    } catch (error) {
      console.error('Error uploading cover:', error);
      toast.error('Failed to update cover');
    } finally {
      setIsUploadingCover(false);
    }
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPosts(prev => 
      prev.includes(postId) 
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    );
  };

  const handleAddSelectedPosts = async () => {
    for (const postId of selectedPosts) {
      await assignPostToFolder.mutateAsync({ postId, folderId: folder.id });
    }
    setSelectedPosts([]);
    setShowAddPostsDialog(false);
  };

  const handleRemoveFromFolder = async (postId: string) => {
    await assignPostToFolder.mutateAsync({ postId, folderId: null });
  };

  return (
    <div className="min-h-[400px]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center gap-3 px-5 py-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="font-display text-lg font-medium text-foreground">{folder.name}</h2>
            <p className="text-xs text-muted-foreground">
              {folderPosts?.length || 0} items
            </p>
          </div>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setShowAddPostsDialog(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </div>

      {/* Cover Image Section (Owner only) */}
      {isOwner && (
        <div className="px-5 py-4 border-b border-border/30">
          <label className="block cursor-pointer">
            <div className={cn(
              "relative aspect-[3/1] rounded-xl overflow-hidden",
              "bg-gradient-to-br from-muted to-muted/50",
              "border border-dashed border-border hover:border-primary/50 transition-colors"
            )}>
              {folder.cover_image_url ? (
                <img 
                  src={folder.cover_image_url} 
                  alt={folder.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                  <Camera className="w-8 h-8 mb-2" />
                  <span className="text-sm">Add cover image</span>
                </div>
              )}
              {folder.cover_image_url && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                  <span className="text-white ml-2 text-sm">Change cover</span>
                </div>
              )}
              {isUploadingCover && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleCoverUpload}
              disabled={isUploadingCover}
            />
          </label>
        </div>
      )}

      {/* Folder Contents */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-1 p-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square bg-muted animate-pulse" />
          ))}
        </div>
      ) : folderPosts?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-5">
          <div className="w-20 h-20 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
            <ImageIcon className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No items yet</h3>
          <p className="text-muted-foreground text-sm max-w-[250px] mb-4">
            Add photos or videos to this folder to showcase your work
          </p>
          {isOwner && (
            <Button onClick={() => setShowAddPostsDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add from Posts
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 p-1">
          {folderPosts?.map((post, index) => (
            <motion.button
              key={post.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
              className="aspect-square relative group overflow-hidden bg-muted"
              onClick={() => onPostClick(post as ProfilePost)}
            >
              {post.media_type === 'video' ? (
                <>
                  <video
                    src={post.media_url || undefined}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                  <div className="absolute top-2 right-2">
                    <Play className="w-4 h-4 text-white drop-shadow-lg" fill="white" />
                  </div>
                </>
              ) : (
                <img
                  src={post.media_url || undefined}
                  alt={post.content || 'Post'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
              
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs">View</span>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Add Posts Dialog */}
      <Dialog open={showAddPostsDialog} onOpenChange={setShowAddPostsDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-display">Add to {folder.name}</DialogTitle>
          </DialogHeader>
          
          {availablePosts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No more posts to add</p>
              <p className="text-xs mt-1">All your posts are already in this folder or have no media</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] -mx-6 px-6">
                <div className="grid grid-cols-3 gap-2">
                  {availablePosts.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => togglePostSelection(post.id)}
                      className={cn(
                        "aspect-square relative rounded-lg overflow-hidden",
                        "ring-2 transition-all",
                        selectedPosts.includes(post.id)
                          ? "ring-primary"
                          : "ring-transparent hover:ring-primary/50"
                      )}
                    >
                      {post.media_type === 'video' ? (
                        <>
                          <video
                            src={post.media_url || undefined}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute top-1 right-1">
                            <Play className="w-3 h-3 text-white drop-shadow-lg" fill="white" />
                          </div>
                        </>
                      ) : (
                        <img
                          src={post.media_url || undefined}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                      
                      {selectedPosts.includes(post.id) && (
                        <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
              
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {selectedPosts.length} selected
                </span>
                <Button 
                  onClick={handleAddSelectedPosts}
                  disabled={selectedPosts.length === 0 || assignPostToFolder.isPending}
                >
                  Add to Folder
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
