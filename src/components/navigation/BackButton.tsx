import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { backTarget } from "@/lib/goBack";
import { cn } from "@/lib/utils";

/** Pop the previous in-app screen. A deep link lands on the feed. */
function useGoBack(fallback = "/feed") {
  const navigate = useNavigate();
  return useCallback(() => {
    const target = backTarget(
      typeof window === "undefined" ? null : window.history.state,
      fallback,
    );
    if (target === -1) navigate(-1);
    else navigate(target);
  }, [fallback, navigate]);
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
      className={cn(showLabel && "gap-2", className)}
      {...props}
    >
      <ArrowLeft className={showLabel ? "h-4 w-4" : "h-5 w-5"} aria-hidden="true" />
      {showLabel ? label : null}
    </Button>
  );
}
