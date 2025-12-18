import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[100px] w-full rounded-xl border border-border/60 bg-input px-4 py-3",
        "text-base text-foreground placeholder:text-muted-foreground/60",
        "ring-offset-background transition-all duration-300 ease-smooth",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50",
        "hover:border-border resize-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "md:text-sm scrollbar-thin",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
