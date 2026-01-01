import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Image, Upload, Video, Loader2, X, Maximize2 } from "lucide-react";
import { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImageContent {
  url?: string;
  alt?: string;
  mediaType?: 'image' | 'video';
}

interface BoardItemImageProps {
  content: Json;
  onChange: (content: Json) => void;
}

export function BoardItemImage({ content, onChange }: BoardItemImageProps) {
  const imageContent = content as ImageContent;
  const [url, setUrl] = useState(imageContent?.url || "");
  const [alt, setAlt] = useState(imageContent?.alt || "");
  const [mediaType, setMediaType] = useState<'image' | 'video'>(imageContent?.mediaType || 'image');
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(!imageContent?.url);
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = content as ImageContent;
    setUrl(c?.url || "");
    setAlt(c?.alt || "");
    setMediaType(c?.mediaType || 'image');
    setShowUrlInput(!c?.url);
  }, [content]);

  const handleBlur = () => {
    onChange({ url, alt, mediaType } as unknown as Json);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    
    if (!isVideo && !isImage) {
      toast.error("Please upload an image or video file");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `board-media/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('board-uploads')
        .upload(filePath, file);

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          toast.error("Storage not configured. Please contact support.");
          return;
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('board-uploads')
        .getPublicUrl(filePath);

      const newMediaType = isVideo ? 'video' : 'image';
      setUrl(publicUrl);
      setMediaType(newMediaType);
      setShowUrlInput(false);
      onChange({ url: publicUrl, alt: file.name, mediaType: newMediaType } as unknown as Json);
      toast.success(`${isVideo ? 'Video' : 'Image'} uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const handleClearMedia = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setUrl("");
    setAlt("");
    setShowUrlInput(true);
    onChange({ url: "", alt: "", mediaType: 'image' } as unknown as Json);
  }, [onChange]);

  const handleExpand = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsExpanded(true);
  }, []);

  return (
    <>
      <div className="p-2 space-y-2">
        {url ? (
          <div className="relative group" data-expand-media>
            {mediaType === 'video' ? (
              <video
                src={url}
                controls
                className="w-full h-auto rounded-md object-contain max-h-48"
                playsInline
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={url}
                alt={alt}
                className="w-full h-auto rounded-md object-contain max-h-48"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            
            {/* Expand button - always visible on mobile, hover on desktop */}
            <Button
              variant="secondary"
              size="icon"
              data-expand-media
              className="absolute top-1 left-1 h-8 w-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white"
              onClick={handleExpand}
              onTouchEnd={handleExpand}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-8 w-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
              onClick={handleClearMedia}
              onTouchEnd={handleClearMedia}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground bg-black/20 rounded-lg">
            {isUploading ? (
              <Loader2 className="w-8 h-8 mb-2 animate-spin" />
            ) : (
              <>
                <div className="flex gap-2 mb-2">
                  <Image className="w-6 h-6" />
                  <Video className="w-6 h-6" />
                </div>
                <span className="text-xs mb-3 text-white/60">Upload or paste URL</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }}
                  className="text-xs min-h-[40px]"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Choose File
                </Button>
              </>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleInputChange}
        />
        {showUrlInput && (
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={handleBlur}
            placeholder="Or paste URL..."
            className="h-8 text-xs border-none bg-white/10 focus-visible:ring-1 text-white placeholder:text-white/40"
          />
        )}
      </div>

      {/* Expanded media modal */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2 sm:p-4 bg-black/95 border-white/10">
          <div className="flex items-center justify-center w-full h-full">
            {mediaType === 'video' ? (
              <video
                src={url}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] rounded-lg"
                playsInline
              />
            ) : (
              <img
                src={url}
                alt={alt}
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
