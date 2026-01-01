import { UserPlus, Share2, Handshake } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Create your profile",
    description: "Set up your creative identity in minutes. Add your portfolio, skills, and what you're looking for.",
  },
  {
    icon: Share2,
    step: "02",
    title: "Share work & connect",
    description: "Post your projects, discover other creators, and build genuine relationships without the noise.",
  },
  {
    icon: Handshake,
    step: "03",
    title: "Collaborate, book & get paid",
    description: "Team up on projects, schedule sessions, send contracts, and receive payments—all in one place.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 md:py-32 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      
      <div className="container relative px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium mb-4">
            How it <span className="text-gradient">works</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started in three simple steps.
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-border/50 hidden sm:block" />
            
            {steps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className={`relative flex flex-col sm:flex-row gap-6 mb-12 last:mb-0 ${
                  index % 2 === 1 ? "sm:flex-row-reverse" : ""
                }`}
              >
                {/* Content */}
                <div className={`flex-1 ${index % 2 === 1 ? "sm:text-right" : ""}`}>
                  <div className={`card-premium rounded-2xl p-6 lg:p-8 ${
                    index % 2 === 1 ? "sm:ml-auto" : ""
                  } max-w-md`}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <step.icon className="w-6 h-6 text-primary" />
                      </div>
                      <span className="text-4xl font-display text-primary/30">{step.step}</span>
                    </div>
                    <h3 className="font-display text-xl font-medium mb-2">{step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
                
                {/* Timeline dot */}
                <div className="absolute left-6 md:left-1/2 top-8 w-3 h-3 -translate-x-1/2 rounded-full bg-primary glow-pink-sm hidden sm:block" />
                
                {/* Spacer for alternating layout */}
                <div className="flex-1 hidden sm:block" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
