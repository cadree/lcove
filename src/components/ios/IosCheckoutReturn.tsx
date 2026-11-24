import { useEffect } from "react";
import { App as CapApp } from "@capacitor/app";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { checkoutReturnPath } from "@/lib/iosStorefront";
import { requestMembershipRefresh } from "@/lib/membershipRefresh";
import { isIosApp } from "@/lib/platform";

/** Refreshes membership when the app reopens, and follows a membership or fund universal link. */
export function IosCheckoutReturn() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isIosApp()) return;
    let cancelled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    const refresh = () => {
      requestMembershipRefresh();
      void queryClient.invalidateQueries({ queryKey: ["fund-stats"] });
    };

    void CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) refresh();
    }).then((handle) => {
      if (cancelled) void handle.remove();
      else handles.push(handle);
    });

    void CapApp.addListener("appUrlOpen", ({ url }) => {
      const path = checkoutReturnPath(url);
      if (!path) return;
      navigate(path);
      refresh();
    }).then((handle) => {
      if (cancelled) void handle.remove();
      else handles.push(handle);
    });

    return () => {
      cancelled = true;
      for (const handle of handles) void handle.remove();
    };
  }, [navigate, queryClient]);

  return null;
}
