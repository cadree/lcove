import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { dialogFramePadding, fullscreenEdgePadding, closeButtonTop } from "@/lib/overlaySafeArea";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-background/80 backdrop-blur-md",
      "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/** Phone cap. Applied after caller style so a child or override cannot widen the dialog. */
const DIALOG_MAX_WIDTH =
  "min(32rem, calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px) - 2rem))";

const dialogContain =
  "box-border min-w-0 max-w-[min(32rem,calc(100vw-2rem))] grid-cols-[minmax(0,1fr)] break-words [&>*]:min-w-0 [&_input]:min-w-0 [&_input]:max-w-full [&_textarea]:min-w-0 [&_textarea]:max-w-full [&_select]:min-w-0 [&_select]:max-w-full [&_img]:min-w-0 [&_img]:max-w-full [&_button]:min-w-0 [&_button]:max-w-full [&_button]:whitespace-normal [&_label]:min-w-0 [&_label]:max-w-full";

function dialogMaxWidth(caller: React.CSSProperties["maxWidth"] | undefined) {
  if (typeof caller === "number" && Number.isFinite(caller)) return `min(${caller}px, ${DIALOG_MAX_WIDTH})`;
  if (typeof caller === "string" && caller.trim()) return `min(${caller}, ${DIALOG_MAX_WIDTH})`;
  return DIALOG_MAX_WIDTH;
}

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  fullscreen?: boolean;
};

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, style, fullscreen = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <div
      className={cn(
        "fixed inset-0 z-50 flex overflow-hidden",
        fullscreen ? "pointer-events-auto items-stretch justify-stretch" : "items-center justify-center",
      )}
      style={
        fullscreen
          ? undefined
          : {
              paddingTop: dialogFramePadding("top"),
              paddingRight: dialogFramePadding("right"),
              paddingBottom: dialogFramePadding("bottom"),
              paddingLeft: dialogFramePadding("left"),
            }
      }
    >
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 w-full min-w-0",
          fullscreen
            ? "flex h-[100dvh] max-h-[100dvh] max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-none"
            : "grid max-w-lg gap-4 rounded-[16px] border border-border bg-card p-6 shadow-elevated max-h-[85vh] overflow-x-hidden overflow-y-auto scrollbar-thin",
          !fullscreen && dialogContain,
          "data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out",
          className
        )}
        style={{
          ...style,
          boxSizing: "border-box",
          width: "100%",
          minWidth: 0,
          maxWidth: fullscreen ? "100%" : dialogMaxWidth(style?.maxWidth),
          ...(fullscreen
            ? {
                paddingTop: fullscreenEdgePadding("top", style?.paddingTop),
                paddingRight: fullscreenEdgePadding("right", style?.paddingRight),
                paddingBottom: fullscreenEdgePadding("bottom", style?.paddingBottom),
                paddingLeft: fullscreenEdgePadding("left", style?.paddingLeft),
              }
            : {}),
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-3 z-10 rounded-lg p-1.5 opacity-70 transition-all hover:opacity-100 hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none"
          style={{ top: closeButtonTop(fullscreen) }}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </div>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex min-w-0 flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex min-w-0 flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-display text-xl font-medium leading-none tracking-tight text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
