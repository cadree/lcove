import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  SAFE_BOTTOM,
  SAFE_TOP,
  closeButtonTop,
  sheetPadsBottom,
  sheetPadsTop,
  splitOverlayBodyClasses,
  type OverlaySide,
} from "@/lib/overlaySafeArea";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-background/80 backdrop-blur-md",
      "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetContain =
  "box-border min-w-0 overflow-x-hidden break-words [&>*]:min-w-0 [&_input]:min-w-0 [&_input]:max-w-full [&_textarea]:min-w-0 [&_textarea]:max-w-full [&_select]:min-w-0 [&_select]:max-w-full [&_img]:min-w-0 [&_img]:max-w-full [&_button]:min-w-0 [&_button]:max-w-full [&_button]:whitespace-normal [&_label]:min-w-0 [&_label]:max-w-full";

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-card border-border/50 p-6 shadow-elevated transition-all ease-smooth data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-400",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b rounded-b-2xl data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t rounded-t-[28px] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-md",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-md",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  overlayClassName?: string;
  overlayStyle?: React.CSSProperties;
}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = "right", className, children, overlayClassName, overlayStyle, style, ...props }, ref) => {
    const edge = (side ?? "right") as OverlaySide;
    const merged = cn(sheetVariants({ side: edge }), "scrollbar-thin overflow-y-auto", className);
    const { shell, body } = splitOverlayBodyClasses(merged);
    const padTop = sheetPadsTop(edge);
    const padBottom = sheetPadsBottom(edge);

    return (
      <SheetPortal>
        <SheetOverlay className={overlayClassName} style={overlayStyle} />
        <SheetPrimitive.Content
          ref={ref}
          className={cn(shell, "flex min-h-0 flex-col overflow-hidden")}
          style={{
            ...style,
            boxSizing: "border-box",
            minWidth: 0,
            paddingTop: padTop ? SAFE_TOP : style?.paddingTop,
            paddingBottom: padBottom ? SAFE_BOTTOM : style?.paddingBottom,
          }}
          {...props}
        >
          <SheetPrimitive.Close
            className="absolute right-3 z-20 inline-flex !min-h-11 !min-w-11 items-center justify-center rounded-md text-foreground hover:bg-muted"
            style={{ top: closeButtonTop(padTop) }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </SheetPrimitive.Close>
          <div className={cn("flex min-h-0 w-full flex-1 flex-col overflow-y-auto scrollbar-thin", sheetContain, body)}>
            {children}
          </div>
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("font-display text-xl font-medium text-foreground", className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
