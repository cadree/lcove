import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EtherWordmark } from "@/components/brand/EtherWordmark";
import { HERO_SUB, HERO_TAGLINE } from "@/content/copy";
import { captureSignupAttribution } from "@/lib/signupAttribution";
import { publicJoinPath } from "@/lib/publicJoin";

export function LandingHero() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    captureSignupAttribution(location.search, location.pathname, window.localStorage);
  }, [location.pathname, location.search]);

  return (
    <section className="relative pb-10 pt-8">
      <div className="mx-auto flex max-w-md flex-col items-center px-4 text-center sm:px-6 lg:max-w-lg">
        <h1 className="mb-6">
          <EtherWordmark className="w-[18rem] max-w-full" />
        </h1>
        <p className="lore mb-4 text-[22px] text-foreground">{HERO_TAGLINE}</p>
        <p className="mb-8 text-base leading-relaxed text-muted-foreground">{HERO_SUB}</p>
        {/* Reserved for 2–3 consented member portraits. Empty until Cadre picks who appears. */}
        <div className="mb-8 flex items-center justify-center -space-x-3" aria-hidden="true">
          {[0, 1, 2].map((slot) => (
            <span
              key={slot}
              className="h-14 w-14 rounded-full border border-primary/20 bg-gradient-to-b from-primary/[0.06] to-transparent shadow-[inset_0_0_16px_rgba(255,159,200,0.08)]"
            />
          ))}
        </div>
        <Button className="w-full" onClick={() => navigate(publicJoinPath(location.search))}>
          Join
        </Button>
      </div>
    </section>
  );
}
