import { useState } from "react";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { FABActionSheet } from "./FABActionSheet";

// Pages where FAB should NOT appear
const excludedPaths = ["/", "/landing", "/auth", "/onboarding", "/locked", "/sign-contract"];

export function GlobalFAB() {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Don't show FAB on excluded paths or if not authenticated
  const shouldShow = user && !excludedPaths.some(path => 
    location.pathname === path || location.pathname.startsWith("/sign-contract/")
  );

  if (!shouldShow) return null;

  return (
    <>
      {/* FAB Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className="fixed z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center touch-manipulation"
        style={{
          right: "1rem",
          bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
        }}
        aria-label="Open actions menu"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isOpen ? "close" : "open"}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Plus className={`h-7 w-7 transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`} />
          </motion.div>
        </AnimatePresence>
      </motion.button>

      {/* Action Sheet */}
      <FABActionSheet open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
