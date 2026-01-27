import { useState, useRef } from "react";
import { Image, Video, Upload, X, Loader2, StickyNote, Trash2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useContactMedia, ContactMedia } from "@/hooks/useContactMedia";
import { toast } from "sonner";

interface ContactGallerySectionProps {
  pipelineItemId: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
}

export function ContactGallerySection({ pipelineItemId }: ContactGallerySectionProps) {
  const { media, isLoading, uploadMedia, updateNotes, deleteMedia, isUploading } = useContactMedia(pipelineItemId);
  const [selectedMedia, setSelectedMedia] = useState<ContactMedia | null>(null);
  const [editingNotes, setEditingNotes] = useState("");
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    setUploadingCount(fileArray.length);
    
    // Initialize upload queue
    setUploadQueue(fileArray.map(f => ({ fileName: f.name, progress: 0 })));

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isImage) {
        failCount++;
        setUploadQueue(prev => prev.map((p, idx) => 
          idx === i ? { ...p, progress: -1 } : p
        ));
        continue;
      }

      try {
        // Simulate progress
        setUploadQueue(prev => prev.map((p, idx) => 
          idx === i ? { ...p, progress: 50 } : p
        ));
        
        await uploadMedia({
          file,
          mediaType: isVideo ? 'video' : 'image',
        });
        
        setUploadQueue(prev => prev.map((p, idx) => 
          idx === i ? { ...p, progress: 100 } : p
        ));
        successCount++;
      } catch {
        setUploadQueue(prev => prev.map((p, idx) => 
          idx === i ? { ...p, progress: -1 } : p
        ));
        failCount++;
      }
    }
    
    // Clear queue after short delay
    setTimeout(() => {
      setUploadQueue([]);
      setUploadingCount(0);
    }, 1000);
    
    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} file(s) failed`);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedMedia) return;
    try {
      await updateNotes({ mediaId: selectedMedia.id, notes: editingNotes });
      setSelectedMedia({ ...selectedMedia, notes: editingNotes });
      toast.success("Notes saved");
    } catch (error) {
      toast.error("Failed to save notes");
    }
  };

  const handleDelete = async (mediaId: string) => {
    try {
      await deleteMedia(mediaId);
      setSelectedMedia(null);
      toast.success("Media deleted");
    } catch (error) {
      toast.error("Failed to delete media");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm text-foreground">Gallery</h3>
          <span className="text-xs text-muted-foreground">({media.length})</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          role="button"
          aria-label="Upload media"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : media.length === 0 ? (
        <div 
          className="text-center py-8 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-2 border-dashed border-border/50"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <ImagePlus className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-muted-foreground">Add photos or videos</p>
          <p className="text-xs text-muted-foreground/60 mt-1">No limit — add as many as you need</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Upload progress */}
          {uploadQueue.length > 0 && (
            <div className="p-3 bg-muted/30 rounded-lg space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Uploading {uploadingCount} file(s)...
              </p>
              {uploadQueue.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate max-w-[150px]">{item.fileName}</span>
                    <span className={item.progress === -1 ? "text-destructive" : item.progress === 100 ? "text-primary" : ""}>
                      {item.progress === -1 ? "Failed" : item.progress === 100 ? "Done" : `${item.progress}%`}
                    </span>
                  </div>
                  {item.progress >= 0 && item.progress < 100 && (
                    <Progress value={item.progress} className="h-1" />
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Media grid */}
          <div className="grid grid-cols-3 gap-2">
            {media.map((item) => (
              <div
                key={item.id}
                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
              >
                <div 
                  onClick={() => {
                    setSelectedMedia(item);
                    setEditingNotes(item.notes || "");
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedMedia(item)}
                  className="w-full h-full"
                >
                  {item.media_type === 'video' ? (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Video className="w-6 h-6 text-muted-foreground" />
                    </div>
                  ) : (
                    <img
                      src={item.media_url}
                      alt="Contact media"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                {item.notes && (
                  <div className="absolute bottom-1 left-1 bg-background/80 rounded p-0.5">
                    <StickyNote className="w-3 h-3 text-primary" />
                  </div>
                )}
                {/* Delete button on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                  className="absolute top-1 right-1 p-1.5 bg-destructive/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                  aria-label="Delete media"
                >
                  <Trash2 className="w-3 h-3 text-destructive-foreground" />
                </button>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
              </div>
            ))}
            
            {/* Add more button */}
            <div
              className="aspect-square rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <ImagePlus className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
        </div>
      )}

      {/* Media Detail Dialog */}
      <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && setSelectedMedia(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Media Details</DialogTitle>
          </DialogHeader>
          
          {selectedMedia && (
            <div className="space-y-4">
              {selectedMedia.media_type === 'video' ? (
                <video
                  src={selectedMedia.media_url}
                  controls
                  className="w-full rounded-lg"
                />
              ) : (
                <img
                  src={selectedMedia.media_url}
                  alt="Contact media"
                  className="w-full rounded-lg"
                />
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="Add notes about this media..."
                  className="min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button onClick={handleSaveNotes} className="flex-1" role="button">
                    Save Notes
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="icon"
                    onClick={() => handleDelete(selectedMedia.id)}
                    role="button"
                    aria-label="Delete media"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
