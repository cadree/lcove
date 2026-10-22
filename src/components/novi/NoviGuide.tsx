import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useNoviQuests } from "@/hooks/useNoviQuests";
import { nextQuest, suggestedActions } from "@/lib/noviQuests";
import { searchGuide } from "@/lib/noviGuide";
import { NOVI_GUIDE_FALLBACK } from "@/content/noviGuide";
import { XpMeter } from "@/components/novi/XpMeter";

function useWideScreen(): boolean {
  const [wide, setWide] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const onChange = () => setWide(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return wide;
}

export function NoviGuide({
  open,
  onOpenChange,
  burstToken = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  burstToken?: number;
}) {
  const wide = useWideScreen();
  const { quests, total, dailyDone, signals } = useNoviQuests();
  const quest = nextQuest(quests);
  const actions = suggestedActions(signals, { dailyDone, limit: 3 });
  const [query, setQuery] = useState("");
  const results = searchGuide(query);
  const missed = query.trim().length > 0 && results.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "border-border bg-card px-4 pb-8" : "max-h-[85vh] border-border bg-card px-4 pb-8"}
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded-full bg-foreground/20 md:hidden" aria-hidden="true" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="mono-label text-[8px] text-[hsl(var(--brand))]">Novi // Guide</p>
            <SheetTitle className="ether-title text-left text-[28px]">
              Novi
            </SheetTitle>
            <SheetDescription className="sr-only">Quests, suggested actions, and answers from Novi</SheetDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="tap-target inline-flex items-center justify-center text-muted-foreground"
            aria-label="Close guide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="file-panel px-3 py-3">
          <p className="mono-label text-[8px] text-[hsl(var(--brand))]">Quest</p>
          {quest ? (
            <>
              <p className="mt-1 font-body text-[15px] font-extrabold text-foreground">{quest.title}</p>
              <p className="lore text-[14px] text-muted-foreground">{quest.detail}</p>
              <p className="mono-label mt-2 text-[8px] text-muted-foreground">
                {quest.progress}/{quest.target}
              </p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="quest-fill h-full rounded-full bg-[linear-gradient(90deg,#FFD6E8,#FF9FC8)]"
                  style={{ width: `${Math.round((quest.progress / quest.target) * 100)}%` }}
                />
              </div>
            </>
          ) : (
            <p className="mt-1 font-body text-[15px] font-extrabold text-foreground">Quests are done.</p>
          )}
          <div className="mt-3">
            <XpMeter total={total} burstToken={burstToken} />
          </div>
        </section>

        <section className="mt-4">
          <p className="mono-label text-[8px] text-muted-foreground">Next</p>
          {actions.length === 0 ? (
            <p className="mt-2 font-body text-sm text-muted-foreground">Nothing left on this list.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {actions.map((action) => (
                <li key={action.id}>
                  <Link
                    to={action.href}
                    onClick={() => onOpenChange(false)}
                    className="file-panel flex min-h-11 items-center justify-between gap-3 px-3 py-3"
                  >
                    <span>
                      <span className="block font-body text-[15px] font-extrabold text-foreground">{action.title}</span>
                      <span className="lore block text-[14px] text-muted-foreground">{action.detail}</span>
                    </span>
                    <span className="mono-label shrink-0 rounded-full bg-[linear-gradient(180deg,#FFD6E8,#FF9FC8)] px-2 py-1 text-[9px] text-[#0A0A0A]">
                      +{action.xp} XP
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4">
          <label htmlFor="novi-guide-search" className="mono-label text-[8px] text-muted-foreground">
            Questions
          </label>
          <Input
            id="novi-guide-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="mt-2"
            autoComplete="off"
          />
          <p className="sr-only" aria-live="polite">
            {query.trim() ? `${results.length} matches` : `${results.length} questions`}
          </p>
          {missed ? (
            <div className="mt-3">
              <p className="font-body text-sm text-foreground">{NOVI_GUIDE_FALLBACK.message}</p>
              <div className="mt-2 flex gap-2">
                <Link
                  to={NOVI_GUIDE_FALLBACK.helpHref}
                  onClick={() => onOpenChange(false)}
                  className="mono-label inline-flex min-h-11 items-center text-[10px] text-foreground"
                >
                  {NOVI_GUIDE_FALLBACK.helpLabel}
                </Link>
                <Link
                  to={NOVI_GUIDE_FALLBACK.reportHref}
                  onClick={() => onOpenChange(false)}
                  className="mono-label inline-flex min-h-11 items-center text-[10px] text-foreground"
                >
                  {NOVI_GUIDE_FALLBACK.reportLabel}
                </Link>
              </div>
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {results.map((entry) => (
                <li key={entry.id} className="border-b border-border/60 pb-3">
                  <p className="font-body text-[15px] font-extrabold text-foreground">{entry.question}</p>
                  <p className="mt-1 font-body text-sm text-muted-foreground">{entry.answer}</p>
                  <Link
                    to={entry.href}
                    onClick={() => onOpenChange(false)}
                    className="mono-label mt-1 inline-flex min-h-11 items-center text-[10px] text-foreground"
                  >
                    {entry.hrefLabel}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </SheetContent>}
    </Sheet>
  );
}
