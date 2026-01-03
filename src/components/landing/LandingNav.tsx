import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import etherBearLogo from "@/assets/ether-bear-logo.png";

export function LandingNav() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
            <img 
              src={etherBearLogo} 
              alt="Ether" 
              className="w-8 h-8 object-contain"
            />
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
              onClick={() => navigate("/fund")}
              className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Fund
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
            {user ? (
              <Button 
                size="sm"
                onClick={() => navigate("/home")}
                className="glow-pink-sm"
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </nav>
      </div>
    </motion.header>
  );
}
