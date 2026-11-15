import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/seo/PageMeta";
import { FAMILCY_GLOSS, PENDING_BODY, PENDING_GLIMPSE, PENDING_TITLE, PENDING_WELCOME } from "@/content/copy";
import { isHiddenTestAccount } from "@/lib/hiddenTestAccount";
import { EtherWordmark } from "@/components/brand/EtherWordmark";
import { EntryAtmosphere } from "@/components/entry/EntryAtmosphere";

interface Glimpse {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

let glimpseLoad: Promise<Glimpse[]> | null = null;

function loadGlimpse(): Promise<Glimpse[]> {
  if (!glimpseLoad) {
    glimpseLoad = Promise.resolve(
      supabase
        .from("profiles_public")
        .select("user_id, display_name, avatar_url")
        .eq("onboarding_completed", true)
        .not("avatar_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(12)
        .then(({ data }) =>
          (data ?? []).filter((row) => !isHiddenTestAccount(row.display_name)).slice(0, 6),
        ),
    );
  }
  return glimpseLoad;
}

export default function Pending() {
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const reduceMotion = useReducedMotion();
  const [people, setPeople] = useState<Glimpse[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadGlimpse().then((seen) => {
      if (!cancelled) setPeople(seen);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pb-10 pt-16 text-center">
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
        <motion.h1 {...fade(0.12)} className="ether-title text-4xl text-foreground">
          {PENDING_TITLE}
        </motion.h1>
        <motion.p {...fade(0.18)} className="mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">
          {PENDING_BODY}
        </motion.p>
        {profile?.display_name ? (
          <motion.p {...fade(0.22)} className="mt-3 text-sm text-muted-foreground">
            We have your request, {profile.display_name}.
          </motion.p>
        ) : null}

        {people.length > 0 ? (
          <div className="mt-12 w-full">
            <p className="mb-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">{PENDING_GLIMPSE}</p>
            <div className="flex justify-center -space-x-3">
              {people.map((person) => (
                <img
                  key={person.user_id}
                  src={person.avatar_url ?? ""}
                  alt=""
                  title={person.display_name ?? undefined}
                  className="h-14 w-14 rounded-full border-2 border-background object-cover"
                />
              ))}
            </div>
          </div>
        ) : null}

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
