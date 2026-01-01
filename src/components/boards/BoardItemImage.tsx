import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Image, Upload, Video, Loader2 } from "lucide-react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = content as ImageContent;
    setUrl(c?.url || "");
    setAlt(c?.alt || "");
    setMediaType(c?.mediaType || 'image');
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
        // If bucket doesn't exist, create it first
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

  return (
    <div className="p-3 space-y-2">
      {url ? (
        <div className="relative">
          {mediaType === 'video' ? (
            <video
              src={url}
              controls
              className="w-full h-auto rounded-md object-cover max-h-48"
            />
          ) : (
            <img
              src={url}
              alt={alt}
              className="w-full h-auto rounded-md object-cover max-h-48"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
          {isUploading ? (
            <Loader2 className="w-8 h-8 mb-2 animate-spin" />
          ) : (
            <>
              <div className="flex gap-2 mb-2">
                <Image className="w-6 h-6" />
                <Video className="w-6 h-6" />
              </div>
              <span className="text-xs mb-3">Upload or paste URL</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs"
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
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={handleBlur}
        placeholder="Or paste URL..."
        className="h-7 text-xs border-none bg-muted/50 focus-visible:ring-1"
      />
    </div>
  );
}
