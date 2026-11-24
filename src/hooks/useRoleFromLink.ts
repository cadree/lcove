import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { roleOpen, type CallRole } from "@/lib/openCalls";

/**
 * Scroll the project's role picker (#roles) into view. Arriving from a link,
 * the page may still be laying out (or resetting scroll on navigation), so
 * check again a few times until the picker is near the top.
 */
export function scrollToRoles(settle = false) {
  let tries = 0;
  const go = () => {
    const el = document.getElementById("roles");
    const top = el?.getBoundingClientRect().top;
    if (el && (tries === 0 || Math.abs(top! - 64) > 80)) el.scrollIntoView({ behavior: tries === 0 ? "smooth" : "auto", block: "start" });
    if (settle && ++tries < 5) window.setTimeout(go, 400);
  };
  requestAnimationFrame(go);
}

/**
 * `/project/:id?role=<roleId>` from an open call: once the roles load, pick
 * that role in the apply form and scroll to it. Full or unknown roles are ignored.
 */
export function useRoleFromLink(roles: CallRole[] | undefined, pick: (roleId: string) => void, skip = false) {
  const [params] = useSearchParams();
  const wanted = params.get("role");
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (skip || !wanted || !roles?.length || done.current === wanted) return;
    const role = roles.find((r) => r.id === wanted);
    done.current = wanted;
    if (!roleOpen(role)) return;
    pick(wanted);
    scrollToRoles(true);
  }, [skip, wanted, roles, pick]);
}
