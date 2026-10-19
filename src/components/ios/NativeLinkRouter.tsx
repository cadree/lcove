import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/** Follows ether:navigate events from universal links and notification taps. */
export function NativeLinkRouter() {
  const navigate = useNavigate();

  useEffect(() => {
    const onNavigate = (event: Event) => {
      const path = (event as CustomEvent<string>).detail;
      if (typeof path === "string" && path.startsWith("/") && !path.startsWith("//")) {
        navigate(path);
      }
    };
    window.addEventListener("ether:navigate", onNavigate);
    return () => window.removeEventListener("ether:navigate", onNavigate);
  }, [navigate]);

  return null;
}
