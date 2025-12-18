import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
const CTASection = () => {
  return <section className="py-32 px-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        
      </div>

      <motion.div initial={{
      opacity: 0,
      y: 30
    }} whileInView={{
      opacity: 1,
      y: 0
    }} viewport={{
      once: true
    }} transition={{
      duration: 0.7
    }} className="relative z-10 max-w-3xl mx-auto text-center">
        <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-medium text-foreground mb-6">
          Ready to Build <span className="text-gradient-pink">Together?</span>
        </h2>
        <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
          Join a community that values contribution over clout. 
          Your reputation grows through what you create, not who follows you.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/auth">
            <Button variant="pink" size="xl" className="group">
              Create Your Profile
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link to="/projects">
            <Button variant="glass" size="xl">
              Browse Projects
            </Button>
          </Link>
        </div>
      </motion.div>
    </section>;
};
export default CTASection;