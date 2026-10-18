import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export function LandingHero() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[80vh] flex items-center">
      <div className="container relative px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <p className="eyebrow mb-4">Ether</p>
            <h1 className="ether-title text-5xl sm:text-6xl lg:text-7xl mb-4">
              The creative community OS
            </h1>
            <span className="mx-auto lg:mx-0 mb-6 block h-px w-16 bg-[hsl(var(--ether-pink))]" aria-hidden="true" />
            <p className="text-lg text-foreground mb-8">Free to join.</p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button size="lg" className="min-h-11" onClick={() => navigate("/auth")}>
                Join
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="min-h-11"
                onClick={() => navigate("/community")}
              >
                Community updates
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="hidden lg:block"
          >
            <div className="border border-border p-4">
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="aspect-square bg-muted rounded-[2px]" />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
