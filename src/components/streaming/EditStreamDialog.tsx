import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { LiveStream, useSaveReplay, useDeleteStream } from '@/hooks/useLiveStreams';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Image, Upload, X, Loader2, Trash2, Save, Move } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface EditStreamDialogProps {
  stream: LiveStream | null;
  open: boolean;
  onClose: () => void;
}

export const EditStreamDialog: React.FC<EditStreamDialogProps> = ({
  stream,
  open,
  onClose,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [focalPoint, setFocalPoint] = useState({ x: 50, y: 50 });
  const [isAdjustingFocal, setIsAdjustingFocal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  const deleteStream = useDeleteStream();

  useEffect(() => {
    if (stream) {
      setTitle(stream.title);
      setDescription(stream.description || '');
      setThumbnailPreview(stream.thumbnail_url || null);
      setFocalPoint(stream.thumbnail_focal_point || { x: 50, y: 50 });
      setThumbnailFile(null);
      setIsAdjustingFocal(false);
    }
  }, [stream]);

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }
    
    setThumbnailFile(file);
    setFocalPoint({ x: 50, y: 50 }); // Reset focal point for new image
    const reader = new FileReader();
    reader.onloadend = () => {
      setThumbnailPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setFocalPoint({ x: 50, y: 50 });
    setIsAdjustingFocal(false);
  };

  const handleFocalPointClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAdjustingFocal || !imageContainerRef.current) return;
    
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    
    setFocalPoint({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  const handleSave = async () => {
    if (!stream) return;
    
    setIsSaving(true);
    try {
      let thumbnailUrl = stream.thumbnail_url;
      
      // Upload new thumbnail if selected
      if (thumbnailFile) {
        setIsUploading(true);
        const fileExt = thumbnailFile.name.split('.').pop();
        const fileName = `thumbnails/${stream.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, thumbnailFile, { upsert: true });
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);
        
        thumbnailUrl = urlData.publicUrl;
        setIsUploading(false);
      } else if (!thumbnailPreview && stream.thumbnail_url) {
        // Thumbnail was removed
        thumbnailUrl = null;
      }
      
      // Update stream
      const { error } = await supabase
        .from('live_streams')
        .update({
          title,
          description: description || null,
          thumbnail_url: thumbnailUrl,
          thumbnail_focal_point: focalPoint,
        })
        .eq('id', stream.id);
      
      if (error) throw error;
      
      toast.success('Stream updated successfully');
      onClose();
    } catch (error) {
      console.error('Error saving stream:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!stream) return;
    
    try {
      await deleteStream.mutateAsync(stream.id);
      onClose();
    } catch (error) {
      // Error handled in hook
    }
  };

  if (!stream) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Stream</DialogTitle>
          <DialogDescription>
            Update your stream details and cover art
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Cover Art */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Cover Art</Label>
              {thumbnailPreview && (
                <Button
                  variant={isAdjustingFocal ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIsAdjustingFocal(!isAdjustingFocal)}
                >
                  <Move className="h-3 w-3 mr-1" />
                  {isAdjustingFocal ? 'Done' : 'Adjust Focus'}
                </Button>
              )}
            </div>
            {thumbnailPreview ? (
              <div 
                ref={imageContainerRef}
                className={`relative aspect-video rounded-lg overflow-hidden bg-muted ${isAdjustingFocal ? 'cursor-crosshair ring-2 ring-primary' : ''}`}
                onClick={handleFocalPointClick}
              >
                <img
                  src={thumbnailPreview}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                  style={{
                    objectPosition: `${focalPoint.x}% ${focalPoint.y}%`
                  }}
                />
                {/* Focal point indicator */}
                {isAdjustingFocal && (
                  <>
                    <div 
                      className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ left: `${focalPoint.x}%`, top: `${focalPoint.y}%` }}
                    >
                      <div className="w-full h-full rounded-full border-2 border-white shadow-lg bg-primary/30 animate-pulse" />
                      <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md" />
                    </div>
                    <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                    <p className="absolute bottom-2 left-2 right-2 text-center text-xs text-white bg-black/60 rounded px-2 py-1">
                      Click to set the focus point
                    </p>
                  </>
                )}
                {!isAdjustingFocal && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={removeThumbnail}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 cursor-pointer transition-colors bg-muted/50">
                <Image className="h-10 w-10 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Click to upload cover art
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Stream title"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your stream..."
              rows={3}
            />
          </div>

          {/* Replay URL (read-only if exists) */}
          {stream.replay_url && (
            <div className="space-y-2">
              <Label>Replay URL</Label>
              <Input
                value={stream.replay_url}
                readOnly
                className="bg-muted text-muted-foreground"
              />
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Stream?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this stream and its replay. This action cannot be undone.
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

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isUploading ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
