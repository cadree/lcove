import { digitalPurchasesEnabled } from "@/lib/platform";
import { cn } from "@/lib/utils";

interface IosDigitalGoodsNoticeProps {
  variant?: "short" | "full";
  kind?: "purchase" | "billing" | "donation";
  className?: string;
}

/**
 * Shown in place of Stripe checkout on iOS when the App Store storefront
 * is not USA. The US storefront uses Safari instead of this notice.
 */
export function IosDigitalGoodsNotice({
  variant = "full",
  kind = "purchase",
  className,
}: IosDigitalGoodsNoticeProps) {
  if (digitalPurchasesEnabled()) return null;

  const text =
    kind === "donation"
      ? "Support isn't available in the iOS app. Card support inside the app isn't allowed, and this screen does not link out to a payment page."
      : kind === "billing"
      ? "Subscription billing isn't available in the iOS app."
      : variant === "short"
        ? "This purchase isn't available in the iOS app."
        : "Memberships, exclusive music, and cinema or artist subscriptions aren't available to buy in the iOS app.";

  return <p className={cn("text-sm text-muted-foreground", className)}>{text}</p>;
}
