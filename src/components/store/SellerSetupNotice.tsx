import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { SELLER_SETUP_INCOMPLETE_MESSAGE } from "@/lib/sellerPaymentSetup";

/** Shown in place of a card checkout button when the seller or host can't be paid directly yet. */
export function SellerSetupNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      data-testid="seller-setup-notice"
      className={cn("flex items-start gap-2 rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground", className)}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{SELLER_SETUP_INCOMPLETE_MESSAGE}</p>
    </div>
  );
}
