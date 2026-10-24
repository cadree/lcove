export const loadFeed = () => import("@/pages/Feed");
export const loadExplore = () => import("@/pages/Explore");
export const loadMessages = () => import("@/pages/Messages");
export const loadProfile = () => import("@/pages/Profile");

const tabLoads = [loadFeed, loadExplore, loadMessages, loadProfile];

/** Wait until the first screen has painted before warming the other tabs. */
export const TAB_PREFETCH_DELAY_MS = 12_000;

/** Pull the four tab screens after the landing work is done. A tap still prefetches that one tab. */
export function prefetchMainTabs() {
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
