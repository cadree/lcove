import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CARD_INTRO_ADD_WALLET,
  CARD_INTRO_GOT_IT,
  CARD_INTRO_KEEP_HANDY_LINE,
  CARD_INTRO_POINTS,
  CARD_INTRO_TITLE,
  CARD_INTRO_VIEW_CARD,
  CARD_INTRO_WALLET_LINE,
  cardIntroAction,
} from "@/lib/cardIntro";

export function EtherCardIntro({
  open,
  onOpenChange,
  walletVisible,
  onAddToWallet,
  onViewCard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletVisible: boolean;
  onAddToWallet?: () => void;
  onViewCard: () => void;
}) {
  const action = cardIntroAction(walletVisible);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && (
        <SheetContent side="bottom" className="mx-auto w-full max-w-lg" data-testid="ether-card-intro">
          <SheetHeader className="pr-10 text-left">
            <SheetTitle className="ether-title text-[28px]">{CARD_INTRO_TITLE}</SheetTitle>
            <SheetDescription className="sr-only">
              Why your ETHER Card matters, and how to keep it with you.
            </SheetDescription>
          </SheetHeader>
          <ol className="mt-5 space-y-4">
            {CARD_INTRO_POINTS.map((point, index) => (
              <li key={point.heading} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs text-muted-foreground" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{point.heading}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm leading-relaxed text-foreground">
            {action === "wallet" ? CARD_INTRO_WALLET_LINE : CARD_INTRO_KEEP_HANDY_LINE}
          </p>
          <SheetFooter className="mt-2 flex-col gap-2 sm:flex-col">
            {action === "wallet" ? (
              <Button
                type="button"
                className="min-h-12 w-full"
                onClick={() => {
                  onAddToWallet?.();
                  onOpenChange(false);
                }}
              >
                {CARD_INTRO_ADD_WALLET}
              </Button>
            ) : (
              <Button
                type="button"
                className="min-h-12 w-full"
                onClick={() => {
                  // View first: it tells the page to stay on the card.
                  onViewCard();
                  onOpenChange(false);
                }}
              >
                {CARD_INTRO_VIEW_CARD}
              </Button>
            )}
            <Button type="button" variant="outline" className="min-h-12 w-full" onClick={() => onOpenChange(false)}>
              {CARD_INTRO_GOT_IT}
            </Button>
          </SheetFooter>
        </SheetContent>
      )}
    </Sheet>
  );
}
