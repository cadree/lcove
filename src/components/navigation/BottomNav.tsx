import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Heart, Grid3X3, User, ChevronUp, X } from "lucide-react";
import { useNavCustomization, allNavItems } from "@/hooks/useNavCustomization";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const BottomNav = () => {
  const { activeNavItems } = useNavCustomization();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isOnMembership = location.pathname === "/membership";
  const isOnHome = location.pathname === "/home" || location.pathname === "/";
  const isOnProfile = location.pathname === "/profile";

  // Group all nav items by category for the full menu
  const categories = [
    { label: "Core", items: allNavItems.filter(i => ["home", "feed", "messages", "projects", "calendar"].includes(i.id)) },
    { label: "Discover", items: allNavItems.filter(i => ["directory", "portfolios", "live", "cinema", "community"].includes(i.id)) },
    { label: "Create", items: allNavItems.filter(i => ["pipeline", "boards"].includes(i.id)) },
    { label: "Business", items: allNavItems.filter(i => ["store", "wallet", "mall", "fund"].includes(i.id)) },
    { label: "You", items: allNavItems.filter(i => ["profile", "notifications", "settings"].includes(i.id)) },
  ];

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        touchAction: 'none',
      }}
    >
      <div 
        className="relative glass-strong rounded-t-3xl px-4 py-3 shadow-elevated flex flex-row items-center justify-between pointer-events-auto mx-0 border-t border-border/20"
        style={{ touchAction: 'manipulation' }}
      >
        {/* Subtle top highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        
        {/* Left - Home/Profile Button */}
        <button
          onClick={() => navigate(isOnHome ? "/profile" : "/home")}
          className="flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-300 text-muted-foreground hover:text-foreground active:text-foreground select-none"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
        >
          <motion.div
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.1 }}
            className="flex flex-col items-center gap-0.5"
          >
            {isOnHome ? (
              <>
                <User className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-[9px]">Profile</span>
              </>
            ) : (
              <>
                <Home className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-[9px]">Home</span>
              </>
            )}
          </motion.div>
        </button>

        {/* Center - Full Navigation Menu */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button
              className="flex flex-col items-center justify-center flex-1 h-12 rounded-xl transition-all duration-300 text-foreground hover:bg-accent/40 active:bg-accent/60 select-none mx-2"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <motion.div
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.1 }}
                className="flex items-center gap-2"
              >
                <Grid3X3 className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-sm font-medium">Menu</span>
                <ChevronUp className="w-4 h-4" />
              </motion.div>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl p-0">
            <div className="p-4 border-b border-border/30 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Navigate</h2>
              <button 
                onClick={() => setMenuOpen(false)}
                className="p-2 rounded-full hover:bg-accent/40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto h-full pb-20 p-4 space-y-6">
              {categories.map((category) => (
                <div key={category.label}>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    {category.label}
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    {category.items.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            navigate(item.path);
                            setMenuOpen(false);
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 select-none",
                            isActive 
                              ? "bg-primary/10 text-primary" 
                              : "bg-accent/30 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          <item.icon className="w-6 h-6 mb-1" strokeWidth={isActive ? 2 : 1.5} />
                          <span className="text-[10px] font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* Right - Support/Contribute Button */}
        {!isOnMembership ? (
          <button
            onClick={() => navigate("/membership")}
            className="flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-300 text-primary hover:bg-primary/10 active:bg-primary/20 select-none"
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            <motion.div
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center gap-0.5"
            >
              <Heart className="w-5 h-5" strokeWidth={1.5} />
              <span className="text-[9px] font-medium">Support</span>
            </motion.div>
          </button>
        ) : (
          <div className="w-14" /> // Spacer when on membership page
        )}
      </div>
    </motion.nav>
  );
};

export default BottomNav;
