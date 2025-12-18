import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Video, Upload, Loader2 } from 'lucide-react';
import { useStories } from '@/hooks/useStories';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface StoryUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const StoryUpload = ({ open, onOpenChange }: StoryUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { uploadStory } = useStories();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaType(type);
    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    
    // Reset input value so the same file can be selected again
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    await uploadStory.mutateAsync({ file: selectedFile, mediaType });
    handleClose();
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add to Story</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {!preview ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Upload Area */}
                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="aspect-[9/16] max-h-[400px] rounded-2xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
                >
                  <Upload className="w-10 h-10 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-sm text-center px-4">
                    Tap to select a photo or video
                  </p>
                  <p className="text-muted-foreground/60 text-xs mt-2">
                    Stories expire after 24 hours
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Camera className="w-4 h-4" />
                    Photo
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    <Video className="w-4 h-4" />
                    Video
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                {/* Preview */}
                <div className="relative aspect-[9/16] max-h-[400px] rounded-2xl overflow-hidden bg-muted">
                  {mediaType === 'video' ? (
                    <video
                      src={preview}
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Remove button */}
                  <Button
                    variant="glass"
                    size="icon"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreview(null);
                    }}
                    className="absolute top-3 right-3"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleUpload}
                    disabled={uploadStory.isPending}
                  >
                    {uploadStory.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Share Story'
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Separate file inputs for photo and video */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect(e, 'photo')}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => handleFileSelect(e, 'video')}
            className="hidden"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StoryUpload;