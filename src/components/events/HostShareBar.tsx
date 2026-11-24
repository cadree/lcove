import type { ReactNode } from "react";
import { Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyEventLink, shareEventLink } from "@/lib/shareLink";

export function HostShareBar({ title, url, share }: { title: string; url: string; share?: ReactNode }) {
  const label = url.replace(/^https?:\/\//, "");
  return (
    <div data-testid="host-share-bar">
      <div className="flex gap-2">
        <Button type="button" className="h-11 flex-1 rounded-full" onClick={() => copyEventLink(url)}>
          <Link2 className="mr-2 h-4 w-4" />
          Copy link
        </Button>
        {share ?? (
          <Button type="button" variant="secondary" className="h-11 flex-1 rounded-full" onClick={() => shareEventLink({ title, text: title, url })}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        )}
      </div>
      {label && <p className="mt-2 truncate text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}
