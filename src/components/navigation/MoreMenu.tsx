import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { moreNavItems, visibleMoreItems } from "@/config/appNav";
import { digitalPurchasesEnabled } from "@/lib/platform";
import { cn } from "@/lib/utils";

export function MoreMenuButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="More"
          className={cn("shrink-0", className)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-none border-t border-[hsl(var(--ether-pink))] px-0 pb-8">
        <div className="px-5 pt-2 pb-4">
          <p className="eyebrow">Ether</p>
          <SheetTitle className="ether-title text-3xl font-medium text-left">More</SheetTitle>
        </div>
        <ul className="ether-rule">
          {visibleMoreItems(moreNavItems, !digitalPurchasesEnabled()).map((item) => {
            const active = location.pathname === item.path;
            return (
              <li key={item.id} className="border-b border-border">
                <button
                  type="button"
                  onClick={() => {
                    navigate(item.path);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-5 min-h-11 text-left text-sm",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
