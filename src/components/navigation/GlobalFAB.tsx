import { useState } from "react";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { FABActionSheet } from "./FABActionSheet";

// Pages where FAB should NOT appear
const excludedPaths = ["/", "/landing", "/auth", "/onboarding", "/locked", "/sign-contract"];
export function GlobalFAB() {
  const {
    user
  } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Don't show FAB on excluded paths or if not authenticated
  const shouldShow = user && !excludedPaths.some(path => location.pathname === path || location.pathname.startsWith("/sign-contract/"));
  if (!shouldShow) return null;
  return <>
      {/* FAB Button */}
      <AnimatePresence>
        <motion.button initial={{
        scale: 0,
        opacity: 0
      }} animate={{
        scale: 1,
        opacity: 1
      }} exit={{
        scale: 0,
        opacity: 0
      }} whileTap={{
        scale: 0.9
      }} onClick={() => setIsOpen(true)} className="fixed z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-elevated touch-manipulation tap-target flex-row flex items-start justify-center" style={{
        right: "max(1rem, env(safe-area-inset-right, 1rem))",
        bottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))"
      }} aria-label="Open quick actions menu" aria-expanded={isOpen} aria-haspopup="dialog">
          <motion.div animate={{
          rotate: isOpen ? 45 : 0
        }} transition={{
          duration: 0.2
        }}>
            <Plus className="h-7 w-7" aria-hidden="true" />
          </motion.div>
        </motion.button>
      </AnimatePresence>

      {/* Action Sheet */}
      <FABActionSheet open={isOpen} onOpenChange={setIsOpen} />
    </>;
}