import { motion } from "framer-motion";
import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { EnergyIndicator } from "@/components/energy";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/useProfile";

interface HomeTopBarProps {
  onMenuClick?: () => void;
  subtitle?: string;
}

const HomeTopBar = ({
  onMenuClick,
  subtitle = "Discover"
}: HomeTopBarProps) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  
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
        
        {/* Left - Profile Avatar */}
        <Link to="/profile" aria-label="View my profile">
          <Avatar className="w-10 h-10 ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || "My profile"} />
            <AvatarFallback className="bg-primary/10 text-primary">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
        </Link>

        {/* Center - Brand with Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <img 
            alt="ETHER" 
            className="h-14 w-auto object-contain" 
            src="/lovable-uploads/0996c910-39b6-4669-aa9f-26a5a2e9a5f2.png"
          />
        </div>

        {/* Right - Energy + Notifications */}
        <nav className="flex items-center gap-2" aria-label="Quick actions">
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