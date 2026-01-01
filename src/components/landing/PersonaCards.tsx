import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Palette, Building2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const personas = [
  {
    icon: Palette,
    title: "Creators",
    pain: "Tired of algorithm games and engagement traps?",
    outcome: "Build a portfolio that matters.",
    benefits: [
      "Share work without follower counts",
      "Get discovered by collaborators",
      "Book clients and get paid securely",
    ],
    cta: "Join as Creator",
    ctaAction: "/auth",
  },
  {
    icon: Building2,
    title: "Brands",
    pain: "Struggling to find authentic creative talent?",
    outcome: "Partner with verified creators.",
    benefits: [
      "Access a curated talent pool",
      "Secure contracts and e-sign",
      "Streamlined project collaboration",
    ],
    cta: "Partner with Us",
    ctaAction: "/partners",
  },
  {
    icon: Users,
    title: "Collectives",
    pain: "Hard to organize and grow your community?",
    outcome: "Run your collective like a pro.",
    benefits: [
      "Group messaging and events",
      "Shared project management",
      "Community fund and governance",
    ],
    cta: "Start a Collective",
    ctaAction: "/auth",
  },
];

export function PersonaCards() {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-32">
      <div className="container px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium mb-4">
            Built for <span className="text-gradient-pink">every creative</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you're an individual artist, a brand, or a collective—Ether adapts to your needs.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {personas.map((persona, index) => (
            <motion.div
              key={persona.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="h-full card-premium hover:border-primary/30 transition-all duration-300">
                <CardContent className="p-6 lg:p-8 flex flex-col h-full">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <persona.icon className="w-6 h-6 text-primary" />
                  </div>
                  
                  <h3 className="font-display text-2xl font-medium mb-3">{persona.title}</h3>
                  
                  <p className="text-muted-foreground text-sm mb-2">{persona.pain}</p>
                  <p className="text-foreground font-medium mb-4">{persona.outcome}</p>
                  
                  <ul className="space-y-2 mb-6 flex-grow">
                    {persona.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    variant="outline" 
                    className="w-full border-border/60 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                    onClick={() => navigate(persona.ctaAction)}
                  >
                    {persona.cta}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
