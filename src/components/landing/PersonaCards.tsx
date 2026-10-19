import { Button } from "@/components/ui/button";
import { Palette, Building2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const personas = [
  {
    icon: Palette,
    eyebrow: "Creators",
    title: "A profile and a feed",
    details: ["Profile", "Feed", "Messages"],
    cta: "Join",
    ctaAction: "/auth",
  },
  {
    icon: Building2,
    eyebrow: "Brands",
    title: "Creator profiles and project pages",
    details: ["Directory of creators", "Project pages"],
    cta: "Sign in",
    ctaAction: "/auth",
  },
  {
    icon: Users,
    eyebrow: "Collectives",
    title: "Shared work",
    details: ["Group messaging", "Shared projects"],
    cta: "Sign in",
    ctaAction: "/auth",
  },
];

export function PersonaCards() {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-24">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <p className="eyebrow mb-2">Who it's for</p>
          <h2 className="ether-title text-3xl sm:text-4xl">Three ways in</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {personas.map((persona) => (
            <article key={persona.eyebrow} className="border-t border-border pt-6">
              <persona.icon className="w-5 h-5 mb-4" strokeWidth={1.5} />
              <p className="eyebrow mb-2">{persona.eyebrow}</p>
              <h3 className="ether-title text-2xl mb-4">{persona.title}</h3>
              <ul className="space-y-2 mb-6">
                {persona.details.map((detail) => (
                  <li key={detail} className="text-sm text-muted-foreground">{detail}</li>
                ))}
              </ul>
              <Button variant="outline" className="min-h-11" onClick={() => navigate(persona.ctaAction)}>
                {persona.cta}
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
