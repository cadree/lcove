import { motion } from "framer-motion";
import { Menu, Bell, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { EnergyIndicator } from "@/components/energy";
import { useAuth } from "@/contexts/AuthContext";

interface HomeTopBarProps {
  onMenuClick?: () => void;
  subtitle?: string;
}

const HomeTopBar = ({
  onMenuClick,
  subtitle = "Discover"
}: HomeTopBarProps) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isOnMembership = location.pathname === "/membership";
  
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 px-4 pt-4"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)' }}
      role="banner"
      aria-label="Main navigation"
    >
      <div className="glass-strong rounded-2xl px-4 py-3 shadow-elevated flex items-center justify-between relative">
        {/* Subtle top highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent rounded-t-2xl" aria-hidden="true" />
        
        {/* Left - Menu */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40" 
          onClick={onMenuClick}
          aria-label="Open menu"
          aria-haspopup="dialog"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </Button>

        {/* Center - Brand with Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <img 
            alt="ETHER" 
            className="h-14 w-auto object-contain" 
            src="/lovable-uploads/0996c910-39b6-4669-aa9f-26a5a2e9a5f2.png"
          />
        </div>

        {/* Right - Contribute + Energy + Notifications */}
        <nav className="flex items-center gap-2" aria-label="Quick actions">
          {!isOnMembership && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-3 rounded-xl text-primary hover:text-primary hover:bg-primary/10 gap-1.5" 
              onClick={() => navigate("/membership")}
              aria-label="Contribute to community"
            >
              <Heart className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs font-medium hidden sm:inline">Contribute</span>
            </Button>
          )}
          {user && <EnergyIndicator />}
          <Link to="/notifications" aria-label="View notifications">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40"
            >
              <Bell className="w-5 h-5" aria-hidden="true" />
            </Button>
          </Link>
        </nav>
      </div>
    </motion.header>
  );
};

export default HomeTopBar;