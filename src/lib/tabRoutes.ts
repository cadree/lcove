export const loadFeed = () => import("@/pages/Feed");
export const loadExplore = () => import("@/pages/Explore");
export const loadMessages = () => import("@/pages/Messages");
export const loadProfile = () => import("@/pages/Profile");

const tabLoads = [loadFeed, loadExplore, loadMessages, loadProfile];

/** Wait until the first screen has painted before warming the other tabs. */
export const TAB_PREFETCH_DELAY_MS = 12_000;

/** True when this browser already has a Supabase session. Signed-out member routes render a prompt, not the page. */
export function hasAuthSession(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.includes("-auth-token") && localStorage.getItem(key)) return true;
    }
  } catch {
    // Private mode can throw. Treat that as signed out.
  }
  return false;
}

/** Pull the four tab screens after the landing work is done. A tap still prefetches that one tab. */
export function prefetchMainTabs() {
  // Signed-out /feed, /profile, and /live never mount those screens. Warming them
  // queues the route graph ahead of the splash image.
  if (!hasAuthSession()) return;
  const run = () => {
    for (const load of tabLoads) void load();
  };
  window.setTimeout(() => {
    const idle = window.requestIdleCallback?.bind(window);
    if (idle) idle(run, { timeout: TAB_PREFETCH_DELAY_MS });
    else run();
  }, TAB_PREFETCH_DELAY_MS);
}

export function prefetchTab(path: string) {
  if (path === "/feed") void loadFeed();
  else if (path === "/explore") void loadExplore();
  else if (path === "/messages") void loadMessages();
  else if (path === "/profile") void loadProfile();
}

export function prefetchCreateSheet() {
  void import("@/components/navigation/CreateSheet");
}
