import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { EtherWordmark } from "@/components/brand/EtherWordmark";
import { NoviPeek } from "@/components/novi/NoviPeek";

export function LandingHero() {
  const navigate = useNavigate();

  return (
    <section className="relative pb-10 pt-8">
      <div className="mx-auto flex max-w-md flex-col items-center px-4 text-center sm:px-6">
        <p className="kicker mb-8">Familcy access // Lcove signal</p>
        <EtherWordmark className="mb-6 w-[18rem] max-w-full" />
        <h1 className="ether-title mb-4 max-w-[16ch] text-[38px] leading-[0.95]">
          THE CULTURE OF ASPIRATIONS
        </h1>
        <p className="lore mb-8 text-[22px] text-foreground">Free to join.</p>

        <div className="file-panel relative mb-4 w-full overflow-hidden px-4 pb-[5.6rem] pt-4 text-left">
          <p className="mono-label text-[9px] text-[hsl(var(--brand))]">Signal report</p>
          <p className="mt-2 font-body text-[15px] font-extrabold text-foreground">Enter the signal</p>
          <p className="lore mt-1 text-[15px] text-muted-foreground">Finish onboarding and I&apos;ll show you.</p>
          <Button className="mt-4 w-full" onClick={() => navigate("/auth")}>
            Join
          </Button>
          <NoviPeek />
        </div>

        <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
          Sign in
        </Button>
        <p className="mono-label mt-6 text-[9px] text-muted-foreground">Year 2096 // Creativity preserved</p>
      </div>
    </section>
  );
}
