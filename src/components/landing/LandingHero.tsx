import lotus from "@/assets/brand/silver-lotus.png";
import lcove from "@/assets/brand/silver-lcove.png";
import star from "@/assets/brand/silver-star.png";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EtherWordmark } from "@/components/brand/EtherWordmark";
import { HERO_SUB, HERO_TAGLINE } from "@/content/copy";
import { captureSignupAttribution } from "@/lib/signupAttribution";
import { publicJoinPath } from "@/lib/publicJoin";
import { AppStoreLink } from "@/components/landing/AppStoreLink";

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
        <div className="mb-8 flex items-center justify-center gap-5" aria-label="ETHER creative family">
          {[lotus, lcove, star].map((src, index) => (
            <img key={src} src={src} alt={["Lotus emblem", "LCOVE emblem", "Star emblem"][index]}
              width={72} height={72} className="h-[72px] w-[72px] object-contain" decoding="async" />
          ))}
        </div>
        <div className="flex w-full flex-col items-center gap-3">
          <Button className="w-full" onClick={() => navigate(publicJoinPath(location.search))}>
            Join
          </Button>
          <AppStoreLink className="w-full" />
        </div>
      </div>
    </section>
  );
}
