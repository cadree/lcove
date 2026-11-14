import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-[12px] font-medium ring-offset-background transition-all duration-300 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 font-mono uppercase tracking-[0.14em] active:scale-[0.98] touch-manipulation select-none", {
  variants: {
    variant: {
      default: "border border-[#FF9FC8] bg-[linear-gradient(180deg,#FFD6E8,#FF9FC8)] text-[#0A0A0A] shadow-[0_0_26px_rgba(255,159,200,0.35)] hover:brightness-105",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      outline: "border border-[color-mix(in_srgb,#FF9FC8_30%,transparent)] bg-transparent text-foreground hover:bg-[color-mix(in_srgb,#FF9FC8_10%,transparent)]",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
      ghost: "normal-case tracking-normal font-body text-sm hover:bg-accent/50 hover:text-accent-foreground",
      link: "normal-case tracking-normal font-body text-primary underline-offset-4 hover:underline",
      glass: "glass text-foreground hover:bg-accent/40 hover:border-border/60",
      pink: "border border-[#FF9FC8] bg-[linear-gradient(180deg,#FFD6E8,#FF9FC8)] text-[#0A0A0A] shadow-[0_0_26px_rgba(255,159,200,0.35)] hover:brightness-105",
      nav: "bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40",
      navActive: "bg-primary/15 text-primary border border-primary/20",
      premium: "border border-[#FF9FC8] bg-[linear-gradient(180deg,#FFD6E8,#FF9FC8)] text-[#0A0A0A] shadow-[0_0_26px_rgba(255,159,200,0.35)] hover:brightness-105"
    },
    size: {
      default: "h-11 px-5 py-2.5",
      sm: "h-11 rounded-[11px] px-4 text-[11px]",
      lg: "h-12 rounded-[14px] px-8",
      xl: "h-14 rounded-[14px] px-10",
      icon: "h-11 w-11",
      iconSm: "h-11 w-11 rounded-[11px]",
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
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );


});
Button.displayName = "Button";
export { Button, buttonVariants };