import { Plus } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateFlow } from "@/components/create/CreateFlowContext";

const excludedPaths = ["/", "/landing", "/auth", "/onboarding", "/locked", "/sign-contract"];

/**
 * The old floating plus rendered an empty AnimatePresence, so the control
 * was invisible. Create now lives on the bottom tab. This export stays for
 * any caller that still mounts a plus: it opens the same pick, crop, caption,
 * share flow.
 */
export function GlobalFAB() {
  const { user } = useAuth();
  const location = useLocation();
  const { openCreate } = useCreateFlow();
  const hidden = !user || excludedPaths.some((path) => location.pathname === path || location.pathname.startsWith("/sign-contract/"));
  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={openCreate}
      aria-label="Create"
      className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#FFD6E8] to-[#FF9FC8] text-[#0A0A0A]"
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
