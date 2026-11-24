import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { EtherWordmark } from "@/components/brand/EtherWordmark";
import { EntryAtmosphere } from "@/components/entry/EntryAtmosphere";
import {
  LCOVE_GLOSS,
  LCOVE_GREETING,
  OATH_CTA,
  OATH_KICKER,
  OATH_LINES,
  OATH_MISSION,
  OATH_TITLE,
} from "@/content/copy";

interface Props {
  onComplete: () => void;
  onBack: () => void;
  submitting?: boolean;
}

const OnboardingPledge = ({ onComplete, onBack, submitting = false }: Props) => {
  const reduceMotion = useReducedMotion();
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
      <EntryAtmosphere />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] pt-8 text-center">
        <motion.div {...fade(0)} className="flex w-full justify-center">
          <EtherWordmark className="mx-auto mb-5 w-[8.5rem] max-w-full" />
        </motion.div>
        <motion.p {...fade(0.06)} className="text-sm font-medium tracking-wide text-primary">
          {LCOVE_GREETING}.
        </motion.p>
        <motion.p {...fade(0.08)} className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {LCOVE_GLOSS}
        </motion.p>
        <motion.p
          {...fade(0.12)}
          className="mt-5 text-[11px] font-medium uppercase tracking-[0.22em] text-primary"
        >
          {OATH_KICKER}
        </motion.p>
        <motion.h1 {...fade(0.16)} className="ether-title mt-2 max-w-[16rem] text-[1.85rem] text-foreground sm:max-w-none sm:text-4xl">
          {OATH_TITLE}
        </motion.h1>
        <motion.p {...fade(0.2)} className="mt-3 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {OATH_MISSION}
        </motion.p>

        <div className="mt-7 flex w-full max-w-sm flex-col items-center gap-3.5">
          {OATH_LINES.map((line, index) => (
            <motion.p
              key={line}
              {...fade(reduceMotion ? 0 : 0.28 + index * 0.12)}
              className="text-[15px] leading-snug text-foreground/90"
            >
              {line}
            </motion.p>
          ))}
        </div>
      </div>

      <motion.div
        {...fade(reduceMotion ? 0 : 0.28 + OATH_LINES.length * 0.12)}
        className="safe-footer fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-background via-background/95 to-transparent px-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-6"
      >
        <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-2">
          <Button
            type="button"
            className="h-12 w-full glow-pink"
            onClick={onComplete}
            disabled={submitting}
          >
            {submitting ? "Saving" : OATH_CTA}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 text-muted-foreground"
            onClick={onBack}
            disabled={submitting}
          >
            Back
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingPledge;
