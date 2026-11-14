import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SUPPORT_ETHER_LABEL } from "@/lib/supportCopy";
import { DonateDialog } from "@/components/fund/DonateDialog";

/** Pink pill that opens the existing support dialog. Sits in the page header, not over the feed. */
export function SupportEtherButton({ className }: { className?: string }) {
  return (
    <DonateDialog>
      <Button
        variant="pink"
        size="sm"
        className={cn("h-11 shrink-0 rounded-full px-3 text-[10px]", className)}
        aria-label={SUPPORT_ETHER_LABEL}
      >
        <Heart aria-hidden="true" />
        {SUPPORT_ETHER_LABEL}
      </Button>
    </DonateDialog>
  );
}
