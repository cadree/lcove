import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface LinkContent {
  url?: string;
  title?: string;
}

interface BoardItemLinkProps {
  content: Json;
  onChange: (content: Json) => void;
}

export function BoardItemLink({ content, onChange }: BoardItemLinkProps) {
  const linkContent = content as LinkContent;
  const [url, setUrl] = useState(linkContent?.url || "");
  const [title, setTitle] = useState(linkContent?.title || "");

  useEffect(() => {
    const c = content as LinkContent;
    setUrl(c?.url || "");
    setTitle(c?.title || "");
  }, [content]);

  const handleBlur = () => {
    onChange({ url, title } as unknown as Json);
  };

  const openLink = () => {
    if (url) {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      window.open(fullUrl, '_blank');
    }
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ExternalLink className="w-4 h-4 text-primary flex-shrink-0" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleBlur}
          placeholder="Link title..."
          className="flex-1 h-7 text-sm font-medium border-none bg-transparent p-0 focus-visible:ring-0"
        />
      </div>
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={handleBlur}
        placeholder="https://example.com"
        className="h-7 text-xs text-muted-foreground border-none bg-transparent p-0 focus-visible:ring-0"
      />
      {url && (
        <button
          onClick={openLink}
          className="text-xs text-primary hover:underline"
        >
          Open link →
        </button>
      )}
    </div>
  );
}
