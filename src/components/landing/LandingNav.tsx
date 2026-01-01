import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export function LandingNav() {
  const navigate = useNavigate();

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="container px-4 sm:px-6 lg:px-8 py-4">
        <nav className="glass-strong rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-display font-bold text-lg">E</span>
            </div>
            <span className="font-display text-xl font-medium hidden sm:inline">Ether</span>
          </div>
          
          <div className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => navigate("/community")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Community
            </button>
            <button 
              onClick={() => navigate("/feed")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Feed
            </button>
            <button 
              onClick={() => navigate("/projects")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Projects
            </button>
            <button 
              onClick={() => navigate("/partners")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Partners
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/auth")}
              className="text-muted-foreground hover:text-foreground"
            >
              Sign In
            </Button>
            <Button 
              size="sm"
              onClick={() => navigate("/auth")}
              className="glow-pink-sm"
            >
              Get Started
            </Button>
          </div>
        </nav>
      </div>
    </motion.header>
  );
}
