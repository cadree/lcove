import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { backTarget, parentFallback } from "@/lib/goBack";
import { cn } from "@/lib/utils";

/** Pop the previous in-app screen. A deep link lands on this screen's parent. */
function useGoBack(fallback?: string) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const parent = fallback ?? parentFallback(pathname);
  return useCallback(() => {
    const target = backTarget(
      typeof window === "undefined" ? null : window.history.state,
      parent,
    );
    if (target === -1) navigate(-1);
    else navigate(target);
  }, [parent, navigate]);
}

interface BackButtonProps extends ButtonProps {
  label?: string;
  showLabel?: boolean;
  fallback?: string;
}

export function BackButton({
  label = "Back",
  showLabel = false,
  fallback,
  className,
  variant = "ghost",
  size,
  ...props
}: BackButtonProps) {
  const goBack = useGoBack(fallback);
  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (showLabel ? "sm" : "icon")}
      onClick={goBack}
      aria-label={label}
      className={cn("min-h-11 min-w-11", showLabel && "w-auto gap-2 px-3", className)}
      {...props}
    >
      <ArrowLeft className={showLabel ? "h-4 w-4" : "h-5 w-5"} aria-hidden="true" />
      {showLabel ? label : null}
    </Button>
  );
}
