import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import lcoveMark from "@/assets/lcove-mark-cutout.png";
import { NoviPeek } from "@/components/novi/NoviPeek";

export function LandingHero() {
  const navigate = useNavigate();

  return (
    <section className="relative px-4 pb-10 pt-8 sm:px-6">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <p className="kicker mb-8">Familcy access // Lcove signal</p>
        <img
          src={lcoveMark}
          alt=""
          className="mark-cutout mb-6 h-28 w-28 object-contain"
        />
        <p className="ether-title mb-3 text-[15px] tracking-[0.28em] text-foreground">Ether</p>
        <h1 className="ether-title mb-4 max-w-[16ch] text-[38px] leading-[0.95]">
          The creative community OS
        </h1>
        <p className="lore mb-8 text-[22px] text-foreground">Free to join.</p>

        <div className="file-panel mb-4 w-full px-4 py-4 text-left">
          <p className="mono-label text-[9px] text-[hsl(var(--brand))]">Signal report</p>
          <p className="mt-2 font-body text-[15px] font-extrabold text-foreground">Enter the signal</p>
          <p className="lore mt-1 text-[15px] text-muted-foreground">Finish onboarding and I&apos;ll show you.</p>
          <Button className="mt-4 w-full" onClick={() => navigate("/auth")}>
            Join
          </Button>
        </div>

        <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
          Sign in
        </Button>
        <p className="mono-label mt-6 text-[9px] text-muted-foreground">Year 2096 // Creativity preserved</p>
        <div className="mt-4 flex w-full justify-end">
          <NoviPeek />
        </div>
      </div>
    </section>
  );
}
