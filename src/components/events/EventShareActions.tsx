import { useState } from "react";
import { Copy, Download, Facebook, Image, Loader2, MessageCircle, Send, Share2, Twitter } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CalendarEvent } from "@/hooks/useCalendar";
import { deliverFile, shareToChannel } from "@/lib/shareLink";

export function EventShareActions({
  title,
  text,
  url,
  imageUrl,
  pdfEvent,
}: {
  title: string;
  text: string;
  url: string;
  imageUrl?: string | null;
  pdfEvent: CalendarEvent;
}) {
  const [busy, setBusy] = useState(false);
  const opts = { title, text, url };

  const reportFile = (result: "shared" | "cancelled" | "downloaded" | "unavailable", ready: string) => {
    if (result === "cancelled" || result === "shared") return;
    if (result === "downloaded") {
      toast.success(ready);
      return;
    }
    toast.error("This view could not share the file. The event link is still available from Copy Link.");
  };

  const shareFlyer = async () => {
    setBusy(true);
    try {
      const { flyerPngFile } = await import("@/lib/eventFlyerFile");
      const flyer = await flyerPngFile({ title, imageUrl });
      const result = await deliverFile(flyer.file, opts);
      if (!flyer.usedFlyerImage && result !== "cancelled") {
        toast.message("The flyer image could not be fetched, so the shared file is a title card.");
      }
      if (result === "unavailable") {
        await shareToChannel("instagram", opts);
        return;
      }
      reportFile(result, "Flyer image ready. If Instagram did not open, share that image from your photos.");
    } catch (error) {
      console.error("Flyer share error:", error);
      toast.error("Could not prepare the flyer image");
    } finally {
      setBusy(false);
    }
  };

  const downloadFlyer = async () => {
    setBusy(true);
    try {
      const { generateEventPdf } = await import("@/lib/generateEventPdf");
      const result = await generateEventPdf(pdfEvent);
      reportFile(result, "Event flyer ready");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenuItem onClick={() => shareToChannel("sms", opts)}>
        <MessageCircle className="mr-2 h-4 w-4" />
        Messages
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => shareToChannel("copy", opts)}>
        <Copy className="mr-2 h-4 w-4" />
        Copy Link
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => shareToChannel("whatsapp", opts)}>
        <Send className="mr-2 h-4 w-4" />
        WhatsApp
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => { void shareFlyer(); }} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Image className="mr-2 h-4 w-4" />}
        Instagram (with flyer)
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => shareToChannel("facebook", opts)}>
        <Facebook className="mr-2 h-4 w-4" />
        Facebook
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => shareToChannel("twitter", opts)}>
        <Twitter className="mr-2 h-4 w-4" />
        Twitter / X
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => { void downloadFlyer(); }} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Download Event Flyer
      </DropdownMenuItem>
      {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
        <DropdownMenuItem onClick={() => shareToChannel("native", opts)}>
          <Share2 className="mr-2 h-4 w-4" />
          More...
        </DropdownMenuItem>
      )}
    </>
  );
}

export function GuestShareButton({
  theme,
  variant = "icon",
  ...actions
}: {
  title: string;
  text: string;
  url: string;
  imageUrl?: string | null;
  pdfEvent: CalendarEvent;
  theme: "light" | "dark";
  variant?: "icon" | "bar";
}) {
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <button type="button" aria-label="Share" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur">
            <Share2 className="h-5 w-5" />
          </button>
        ) : (
          <Button type="button" variant="secondary" className="h-11 w-full rounded-full">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={`${theme === "light" ? "light " : ""}border-border/60 bg-card text-foreground`}>
        <EventShareActions {...actions} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
  if (variant === "bar") return <div className="min-w-0 flex-1">{menu}</div>;
  return menu;
}
