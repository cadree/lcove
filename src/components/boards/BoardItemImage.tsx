import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Image } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface ImageContent {
  url?: string;
  alt?: string;
}

interface BoardItemImageProps {
  content: Json;
  onChange: (content: Json) => void;
}

export function BoardItemImage({ content, onChange }: BoardItemImageProps) {
  const imageContent = content as ImageContent;
  const [url, setUrl] = useState(imageContent?.url || "");
  const [alt, setAlt] = useState(imageContent?.alt || "");

  useEffect(() => {
    const c = content as ImageContent;
    setUrl(c?.url || "");
    setAlt(c?.alt || "");
  }, [content]);

  const handleBlur = () => {
    onChange({ url, alt } as unknown as Json);
  };

  return (
    <div className="p-3 space-y-2">
      {url ? (
        <div className="relative">
          <img
            src={url}
            alt={alt}
            className="w-full h-auto rounded-md object-cover max-h-48"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Image className="w-8 h-8 mb-2" />
          <span className="text-xs">Paste image URL below</span>
        </div>
      )}
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={handleBlur}
        placeholder="Image URL..."
        className="h-7 text-xs border-none bg-muted/50 focus-visible:ring-1"
      />
    </div>
  );
}
