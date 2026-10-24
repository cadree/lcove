import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EtherWordmark } from "@/components/brand/EtherWordmark";
import { HERO_TAGLINE } from "@/content/copy";
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
        <p className="kicker mb-8">Familcy access // Lcove signal</p>
        <h1 className="mb-6">
          <EtherWordmark className="w-[18rem] max-w-full" />
        </h1>
        <p className="lore mb-8 text-[22px] text-foreground">{HERO_TAGLINE}</p>
        <Button className="w-full" onClick={() => navigate(publicJoinPath(location.search))}>
          Join
        </Button>
        <p className="mono-label mt-6 text-[9px] text-muted-foreground">Year 2096 // Creativity preserved</p>
      </div>
    </section>
  );
}
