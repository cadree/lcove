import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 font-body active:scale-[0.98] touch-manipulation select-none", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground shadow-glow-sm hover:bg-primary/90 hover:shadow-pink",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline: "border border-border/60 bg-transparent text-foreground hover:bg-accent/50 hover:border-border",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/30",
      ghost: "hover:bg-accent/50 hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
      glass: "glass text-foreground hover:bg-accent/40 hover:border-border/60",
      pink: "bg-primary text-primary-foreground shadow-pink hover:bg-primary/90 hover:shadow-[0_0_50px_hsl(340_82%_65%/0.5)]",
      nav: "bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40",
      navActive: "bg-primary/15 text-primary border border-primary/20",
      premium: "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-pink hover:shadow-[0_0_50px_hsl(340_82%_65%/0.4)]"
    },
    size: {
      default: "h-11 px-5 py-2.5",
      sm: "h-9 rounded-lg px-4 text-xs",
      lg: "h-12 rounded-xl px-8 text-base",
      xl: "h-14 rounded-2xl px-10 text-lg",
      icon: "h-11 w-11",
      iconSm: "h-9 w-9 rounded-lg",
      iconLg: "h-12 w-12"
    }
  },
  defaultVariants: {
    variant: "default",
    size: "default"
  }
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  variant,
  size,
  asChild = false,
  ...props
}, ref) => {
  const Comp = asChild ? Slot : "button";
  return;
});
Button.displayName = "Button";
export { Button, buttonVariants };