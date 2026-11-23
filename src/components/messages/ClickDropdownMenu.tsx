import { cloneElement, useRef, useState, type MouseEvent, type PointerEvent, type ReactElement, type ReactNode } from "react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type TriggerProps = {
  className?: string;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
};

/**
 * Radix DropdownMenuTrigger toggles on pointerdown and calls preventDefault
 * so the trigger does not steal focus. In iOS WKWebView that sequence often
 * opens the menu and then immediately dismisses it, because the same tap's
 * pointerup lands on the new dismiss layer. Playwright Chromium click/tap
 * does not reproduce this. We ignore the pointerdown toggle and open on
 * click, after the finger is up.
 */
export function ClickDropdownMenu({ trigger, children }: { trigger: ReactElement<TriggerProps>; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ignorePointerDownToggle = useRef(false);

  const triggerEl = cloneElement(trigger, {
    className: cn("relative z-20 h-11 min-h-11 min-w-11 w-11 touch-manipulation", trigger.props.className),
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      trigger.props.onPointerDown?.(event);
      ignorePointerDownToggle.current = true;
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      trigger.props.onClick?.(event);
      if (event.defaultPrevented) return;
      setOpen((current) => !current);
    },
  });

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        if (ignorePointerDownToggle.current) {
          ignorePointerDownToggle.current = false;
          return;
        }
        setOpen(next);
      }}
    >
      <DropdownMenuTrigger asChild>{triggerEl}</DropdownMenuTrigger>
      {children}
    </DropdownMenu>
  );
}
