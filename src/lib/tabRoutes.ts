export const loadFeed = () => import("@/pages/Feed");
export const loadExplore = () => import("@/pages/Explore");
export const loadMessages = () => import("@/pages/Messages");
export const loadProfile = () => import("@/pages/Profile");

const tabLoads = [loadFeed, loadExplore, loadMessages, loadProfile];

/** Pull the four tab screens while the splash is still up, so the first tap does not wait on a chunk. */
export function prefetchMainTabs() {
  const run = () => {
    for (const load of tabLoads) void load();
  };
  const idle = window.requestIdleCallback?.bind(window);
  if (idle) idle(run, { timeout: 400 });
  else window.setTimeout(run, 50);
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
