import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const newsletterSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address").max(255),
});

interface FinalCTAProps {
  onOpenCreatorApplication: () => void;
}

export function FinalCTA({ onOpenCreatorApplication }: FinalCTAProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = newsletterSchema.safeParse({ name, email });
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from("newsletter_signups")
        .insert({ name: name.trim(), email: email.trim().toLowerCase() });
      
      if (error) {
        if (error.code === "23505") {
          toast.error("This email is already subscribed!");
        } else {
          throw error;
        }
        return;
      }
      
      setIsSubscribed(true);
      setName("");
      setEmail("");
      toast.success("Welcome to the community! Check your inbox soon.");
    } catch (error) {
      console.error("Newsletter signup error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-20 md:py-32 relative">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.05] via-transparent to-transparent" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-[150px] opacity-50" />
      
      <div className="container relative px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          {/* Main CTA Card */}
          <div className="card-premium rounded-3xl p-8 md:p-12 text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium mb-4">
              Start your creative home on <span className="text-gradient-pink">Ether</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of creators building meaningful connections and launching incredible projects.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="glow-pink text-lg px-8 py-6"
                onClick={() => navigate("/auth")}
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="text-lg px-8 py-6 border-border/60 hover:bg-secondary"
                onClick={onOpenCreatorApplication}
              >
                Apply as a Creator
              </Button>
            </div>
          </div>

          {/* Newsletter Signup */}
          <div className="glass-subtle rounded-2xl p-6 md:p-8">
            <div className="text-center mb-6">
              <h3 className="font-display text-xl font-medium mb-2">Stay in the loop</h3>
              <p className="text-sm text-muted-foreground">
                Get updates on new features, community highlights, and creative opportunities.
              </p>
            </div>
            
            {isSubscribed ? (
              <div className="flex items-center justify-center gap-2 text-primary">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">You're subscribed!</span>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
                <Input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-premium flex-1"
                  required
                />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-premium flex-1"
                  required
                />
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="shrink-0"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </form>
            )}
            
            <p className="text-xs text-muted-foreground text-center mt-4">
              No spam, ever. Unsubscribe anytime.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
