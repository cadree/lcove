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
        
      </AnimatePresence>

      {/* Action Sheet */}
      <FABActionSheet open={isOpen} onOpenChange={setIsOpen} />
    </>;
}