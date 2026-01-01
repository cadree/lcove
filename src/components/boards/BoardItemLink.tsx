import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ExternalLink, Loader2 } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface LinkContent {
  url?: string;
  title?: string;
  description?: string;
  image?: string;
}

interface BoardItemLinkProps {
  content: Json;
  onChange: (content: Json) => void;
  isSelected?: boolean;
}

export function BoardItemLink({ content, onChange, isSelected }: BoardItemLinkProps) {
  const linkContent = content as LinkContent;
  const [url, setUrl] = useState(linkContent?.url || "");
  const [title, setTitle] = useState(linkContent?.title || "");
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    const c = content as LinkContent;
    setUrl(c?.url || "");
    setTitle(c?.title || "");
  }, [content]);

  // Fetch link metadata when URL changes
  const fetchLinkMetadata = useCallback(async (inputUrl: string) => {
    if (!inputUrl || isFetching) return;
    
    const fullUrl = inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`;
    
    // Simple URL validation
    try {
      new URL(fullUrl);
    } catch {
      return;
    }

    setIsFetching(true);
    
    try {
      // Try to extract title from common patterns
      let extractedTitle = "";
      
      // For YouTube
      if (fullUrl.includes('youtube.com') || fullUrl.includes('youtu.be')) {
        const videoId = fullUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?/]+)/)?.[1];
        if (videoId) {
          extractedTitle = "YouTube Video";
        }
      } 
      // For common domains, use the domain as a fallback title
      else {
        try {
          const urlObj = new URL(fullUrl);
          extractedTitle = urlObj.hostname.replace('www.', '');
        } catch {
          extractedTitle = "";
        }
      }

      // Only update if we got something and title is empty
      if (extractedTitle && !title) {
        setTitle(extractedTitle);
        onChange({ url: fullUrl, title: extractedTitle } as unknown as Json);
      } else {
        onChange({ url: fullUrl, title: title || extractedTitle } as unknown as Json);
      }
    } catch (error) {
      console.error('Failed to fetch link metadata:', error);
      onChange({ url: fullUrl, title } as unknown as Json);
    } finally {
      setIsFetching(false);
    }
  }, [isFetching, title, onChange]);

  const handleUrlBlur = () => {
    if (url) {
      fetchLinkMetadata(url);
    } else {
      onChange({ url, title } as unknown as Json);
    }
  };

  const handleTitleBlur = () => {
    onChange({ url, title } as unknown as Json);
  };

  const openLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (url) {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      window.open(fullUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleInputMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        {isFetching ? (
          <Loader2 className="w-4 h-4 text-primary flex-shrink-0 animate-spin" />
        ) : (
          <ExternalLink className="w-4 h-4 text-primary flex-shrink-0" />
        )}
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onMouseDown={handleInputMouseDown}
          onClick={handleInputClick}
          placeholder="Link title..."
          className="flex-1 h-7 text-sm font-medium border-none bg-transparent p-0 focus-visible:ring-0 text-gray-800"
        />
      </div>
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={handleUrlBlur}
        onMouseDown={handleInputMouseDown}
        onClick={handleInputClick}
        placeholder="https://example.com"
        className="h-7 text-xs text-gray-600 border-none bg-transparent p-0 focus-visible:ring-0"
      />
      {url && (
        <button
          type="button"
          onClick={openLink}
          onMouseDown={(e) => e.stopPropagation()}
          className="text-xs text-primary hover:underline font-medium"
        >
          Open link →
        </button>
      )}
    </div>
  );
}
