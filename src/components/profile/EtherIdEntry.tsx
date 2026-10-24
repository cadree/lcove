import { Link } from "react-router-dom";
import { ChevronRight, CreditCard } from "lucide-react";

export function EtherIdEntry() {
  return (
    <div className="px-4 pt-3">
      <Link
        to="/id"
        className="file-panel flex min-h-11 items-center gap-3 px-4 py-3"
      >
        <CreditCard className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="kicker block">Member card</span>
          <span className="ether-title block text-[16px]">Show my ID</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>
    </div>
  );
}
