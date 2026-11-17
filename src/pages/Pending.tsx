import { WaitingFilm } from "@/components/onboarding/WaitingFilm";
import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/seo/PageMeta";
import { FAMILCY_GLOSS, PENDING_BODY, PENDING_TITLE, PENDING_WELCOME } from "@/content/copy";
import { EtherWordmark } from "@/components/brand/EtherWordmark";
import { EntryAtmosphere } from "@/components/entry/EntryAtmosphere";

export default function Pending() {
  const { signOut } = useAuth();
  const { profile, refetch } = useProfile();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void refetch(true); };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refetch]);

  const fade = (delay: number) =>
    reduceMotion
      ? { initial: false as const, animate: { opacity: 1 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.45, ease: "easeOut" as const },
        };

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background">
      <PageMeta title={`${PENDING_TITLE} · Ether`} description={PENDING_BODY} />
      <EntryAtmosphere />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pb-10 pt-10 text-center">
        <motion.div {...fade(0)}>
          <EtherWordmark className="mb-8 w-[11rem] max-w-full" />
        </motion.div>
        <span
          className="mb-8 h-2 w-2 rounded-full bg-primary entry-breath motion-reduce:animate-none"
          aria-hidden="true"
        />
        <motion.p {...fade(0.06)} className="mb-1 text-sm font-medium tracking-wide text-primary">
          {PENDING_WELCOME}
        </motion.p>
        <motion.p {...fade(0.08)} className="mb-8 text-[11px] leading-snug text-muted-foreground">
          {FAMILCY_GLOSS}
        </motion.p>
        <motion.h1 {...fade(0.12)} className="ether-title text-3xl text-foreground">
          Your application is under review.
        </motion.h1>
        <motion.p {...fade(0.18)} className="mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">
          {PENDING_BODY}
        </motion.p>
        {profile?.display_name ? (
          <motion.p {...fade(0.22)} className="mt-3 text-sm text-muted-foreground">
            We have your request, {profile.display_name}.
          </motion.p>
        ) : null}

        <WaitingFilm />

        <Button
          type="button"
          variant="outline"
          className="mt-auto h-12 w-full max-w-xs"
          onClick={() => void signOut().then(() => { window.location.href = "/"; })}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
