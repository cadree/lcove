import { motion } from "framer-motion";
import { Menu, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { EnergyIndicator } from "@/components/energy";
import { useAuth } from "@/contexts/AuthContext";

interface HomeTopBarProps {
  onMenuClick?: () => void;
  subtitle?: string;
}

const HomeTopBar = ({ onMenuClick, subtitle = "Discover" }: HomeTopBarProps) => {
  const { user } = useAuth();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 px-4 pt-4"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 16px), 16px)',
      }}
    >
      <div className="glass-strong rounded-2xl px-4 py-3 shadow-elevated flex items-center justify-between">
        {/* Subtle top highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent rounded-t-2xl" />
        
        {/* Left - Menu */}
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Center - Brand */}
        <div className="flex flex-col items-center">
          <span className="font-display text-lg font-semibold tracking-wide text-foreground">
            ETHER
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {subtitle}
          </span>
        </div>

        {/* Right - Energy + Notifications */}
        <div className="flex items-center gap-2">
          {user && <EnergyIndicator />}
          <Link to="/notifications">
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40"
            >
              <Bell className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </motion.header>
  );
};

export default HomeTopBar;
