import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Settings2 } from "lucide-react";
import { useNavCustomization } from "@/hooks/useNavCustomization";
import { NavCustomizationSheet } from "./NavCustomizationSheet";

const BottomNav = () => {
  const { activeNavItems } = useNavCustomization();

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 16px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        touchAction: 'none', // Prevent scroll interference
      }}
    >
      <div 
        className="relative glass-strong rounded-full px-2 py-2 shadow-elevated flex flex-row items-center justify-center pointer-events-auto mx-4 gap-0.5"
        style={{ touchAction: 'manipulation' }} // Allow taps but prevent zoom/scroll
      >
        {/* Subtle top highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent rounded-t-full" />
        
        {/* Nav items */}
        {activeNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-300 ease-smooth flex-shrink-0 tap-target select-none",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground active:text-foreground"
              )
            }
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-x-2 top-1 bottom-1 rounded-xl bg-primary/10"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <motion.div
                  whileTap={{ scale: 0.92 }}
                  transition={{ duration: 0.1 }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <item.icon
                    className={cn(
                      "w-5 h-5 relative z-10 transition-all duration-300",
                      isActive && "drop-shadow-[0_0_8px_hsl(340_82%_65%/0.5)]"
                    )}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  <span className={cn(
                    "text-[9px] relative z-10 transition-all",
                    isActive ? "text-primary font-medium" : "text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                </motion.div>
              </>
            )}
          </NavLink>
        ))}

        {/* Settings gear for customization */}
        <NavCustomizationSheet>
          <button
            className="relative flex flex-col items-center justify-center w-10 h-12 rounded-xl transition-all duration-300 text-muted-foreground hover:text-foreground active:text-foreground flex-shrink-0 select-none"
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            <motion.div
              whileTap={{ scale: 0.9, rotate: 90 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-0.5"
            >
              <Settings2 className="w-4 h-4" strokeWidth={1.5} />
              <span className="text-[8px]">Edit</span>
            </motion.div>
          </button>
        </NavCustomizationSheet>
      </div>
    </motion.nav>
  );
};

export default BottomNav;
