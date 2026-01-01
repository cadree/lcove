import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export function LandingHero() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] opacity-50" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-ether-tan/10 rounded-full blur-[100px] opacity-40" />
      
      <div className="container relative px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">The creative community OS</span>
            </div>
            
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tight mb-6">
              <span className="text-gradient">Create.</span>{" "}
              <span className="text-gradient-pink">Connect.</span>{" "}
              <span className="text-foreground">Collaborate.</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
              A private operating system for creators, brands, and collectives to share work, 
              launch projects, and grow together—without the noise of social media.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6">
              <Button 
                size="lg" 
                className="glow-pink-sm text-lg px-8 py-6"
                onClick={() => navigate("/auth")}
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="text-lg px-8 py-6 border-border/60 hover:bg-secondary"
                onClick={() => navigate("/community")}
              >
                Explore Community
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              No spam. Cancel anytime. Free to join.
            </p>
          </motion.div>

          {/* Right: Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative">
              {/* Mock UI Card */}
              <div className="card-premium rounded-3xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="h-3 w-24 bg-foreground/10 rounded" />
                    <div className="h-2 w-16 bg-foreground/5 rounded mt-1" />
                  </div>
                </div>
                
                {/* Mock content grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="aspect-square rounded-xl bg-gradient-to-br from-secondary to-muted" />
                  ))}
                </div>
                
                <div className="space-y-2">
                  <div className="h-3 w-full bg-foreground/10 rounded" />
                  <div className="h-3 w-3/4 bg-foreground/5 rounded" />
                </div>
              </div>
              
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 card-premium rounded-2xl p-4 glow-pink-sm">
                <div className="text-2xl font-display text-primary">2.4k+</div>
                <div className="text-xs text-muted-foreground">Creators</div>
              </div>
              
              <div className="absolute -bottom-4 -left-4 card-premium rounded-2xl p-4">
                <div className="text-2xl font-display text-foreground">150+</div>
                <div className="text-xs text-muted-foreground">Cities</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
