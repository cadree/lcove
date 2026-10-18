import { isIosApp } from "@/lib/platform";
import { cn } from "@/lib/utils";

interface IosDigitalGoodsNoticeProps {
  variant?: "short" | "full";
  kind?: "purchase" | "billing";
  className?: string;
}

/**
 * Shown in place of Stripe checkout buttons on iOS.
 * No external purchase link: Apple has to approve that separately.
 */
export function IosDigitalGoodsNotice({
  variant = "full",
  kind = "purchase",
  className,
}: IosDigitalGoodsNoticeProps) {
  if (!isIosApp()) return null;

  const text =
    kind === "billing"
      ? "Subscription billing isn't available in the iOS app."
      : variant === "short"
        ? "This purchase isn't available in the iOS app."
        : "Memberships, exclusive music, and cinema or artist subscriptions aren't available to buy in the iOS app.";

  return <p className={cn("text-sm text-muted-foreground", className)}>{text}</p>;
}
