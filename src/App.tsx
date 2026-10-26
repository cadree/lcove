// Application entry point - Ether App
import { lazy, Suspense, useEffect } from "react";
import { hasAuthSession, loadExplore, loadFeed, loadMessages, loadProfile, prefetchMainTabs } from "@/lib/tabRoutes";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { WorldLayer } from "@/components/world/WorldLayer";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { watchImageCheckPrefetch } from "@/lib/nsfwImageCheck";
import { PresenceProvider } from "@/hooks/usePresence";
import { CreateFlowProvider } from "@/components/create/CreateFlowContext";
import AccessGate from "@/components/auth/AccessGate";
import { EtherSplash } from "@/components/brand/EtherSplash";
import { useTrackActivity } from "@/hooks/useTrackActivity";
import { IosCheckoutReturn } from "@/components/ios/IosCheckoutReturn";
import { NativeIosPush } from "@/components/ios/NativeIosPush";
import { APP_STORE_APPLE_ID, APP_STORE_URL } from "@/config/launch";
import MotionRoot from "@/components/motion/MotionRoot";

// index.html also preloads the open screen. This covers a reload before that
// map exists, and it shares the promise with the lazy route.
if (typeof window !== "undefined") {
  const path = window.location.pathname;
  const session = hasAuthSession();
  if (path === "/" || path === "/landing") void import("./pages/Landing");
  else if (path === "/auth") void import("./pages/Auth");
  else if ((path === "/feed" || path === "/home") && session) void loadFeed();
  else if ((path === "/profile" || path.startsWith("/profile/")) && session) void loadProfile();
  else if (path === "/live" && session) void import("./pages/Live");
  else if (path.startsWith("/live/")) void import("./pages/PublicLivePage");
  else if (path.startsWith("/event/") || path.startsWith("/e/")) void import("./pages/PublicEventPage");
}

const Landing = lazy(() => import("./pages/Landing"));
const Waitlist = lazy(() => import("./pages/Waitlist"));
const Feed = lazy(loadFeed);
const Explore = lazy(loadExplore);
const Directory = lazy(() => import("./pages/Directory"));
const Projects = lazy(() => import("./pages/Projects"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const Profile = lazy(loadProfile);
const EtherId = lazy(() => import("./pages/EtherId"));
const EtherIdVerify = lazy(() => import("./pages/EtherIdVerify"));
const Tickets = lazy(() => import("./pages/Tickets"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Locked = lazy(() => import("./pages/Locked"));
const Denied = lazy(() => import("./pages/Denied"));
const Messages = lazy(loadMessages);
const Notifications = lazy(() => import("./pages/Notifications"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Store = lazy(() => import("./pages/Store"));
const Mall = lazy(() => import("./pages/Mall"));
const FundDashboard = lazy(() => import("./pages/FundDashboard"));
const Membership = lazy(() => import("./pages/Membership"));
const Live = lazy(() => import("./pages/Live"));
const Settings = lazy(() => import("./pages/Settings"));
const BookOfLcove = lazy(() => import("./pages/BookOfLcove"));
const QuestLog = lazy(() => import("./pages/QuestLog"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Cinema = lazy(() => import("./pages/Cinema"));
const NetworkPage = lazy(() => import("./pages/NetworkPage"));
const NetworkManage = lazy(() => import("./pages/NetworkManage"));
const Partners = lazy(() => import("./pages/Partners"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminOnboarding = lazy(() => import("./pages/AdminOnboarding"));
const Community = lazy(() => import("./pages/Community"));
const BookingSettings = lazy(() => import("./pages/BookingSettings"));
const PublicBookingPage = lazy(() => import("./pages/PublicBookingPage"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Today = lazy(() => import("./pages/Today"));
const Boards = lazy(() => import("./pages/Boards"));
const BoardEditor = lazy(() => import("./pages/BoardEditor"));
const SignContract = lazy(() => import("./pages/SignContract"));
const Portfolios = lazy(() => import("./pages/Portfolios"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Guidelines = lazy(() => import("./pages/Guidelines"));
const BrandPartners = lazy(() => import("./pages/BrandPartners"));
const Collectives = lazy(() => import("./pages/Collectives"));
const PartnerPortal = lazy(() => import("./pages/PartnerPortal"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EventsDashboard = lazy(() => import("./pages/EventsDashboard"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const HostHome = lazy(() => import("./pages/HostHome"));
const HostFinance = lazy(() => import("./pages/HostFinance"));
const HostDoor = lazy(() => import("./pages/HostDoor"));
const HostEventEditor = lazy(() => import("./pages/HostEventEditor"));
const EventTickets = lazy(() => import("./pages/EventTickets"));
const EventCheckout = lazy(() => import("./pages/EventCheckout"));
const HostingShots = import.meta.env.DEV ? lazy(() => import("./pages/HostingShots")) : null;
const PublicEventPage = lazy(() => import("./pages/PublicEventPage"));
const PublicProductPage = lazy(() => import("./pages/PublicProductPage"));
const PublicLivePage = lazy(() => import("./pages/PublicLivePage"));
const BlogPostPage = lazy(() => import("./pages/BlogPost"));
const BlogIndex = lazy(() => import("./pages/BlogIndex"));
const EventConfirmation = lazy(() => import("./pages/EventConfirmation"));
const PublicProjectPage = lazy(() => import("./pages/PublicProjectPage"));
const PublicClientPortal = lazy(() => import("@/pages/PublicClientPortal"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Nuance = lazy(() => import("./pages/Nuance"));

const ActivityTracker = () => {
  useTrackActivity();
  return null;
};

function WarmTabs() {
  const { session } = useAuth();
  useEffect(() => {
    prefetchMainTabs();
  }, []);
  useEffect(() => watchImageCheckPrefetch(session != null), [session]);
  useEffect(() => {
    const onRemoved = () => {
      void queryClient.invalidateQueries();
    };
    window.addEventListener("ether-image-removed", onRemoved);
    return () => window.removeEventListener("ether-image-removed", onRemoved);
  }, []);
  return null;
}

function StoreListingMeta() {
  useEffect(() => {
    if (!APP_STORE_URL || !APP_STORE_APPLE_ID) return;
    const meta = document.createElement("meta");
    meta.name = "apple-itunes-app";
    meta.content = `app-id=${APP_STORE_APPLE_ID}`;
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);
  return null;
}

function RouteFallback() {
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground"
    >
      Loading…
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <ThemeProvider>
        <WorldLayer />
        <AuthProvider>
          <IosCheckoutReturn />
          <NativeIosPush />
          <PresenceProvider>
            <CreateFlowProvider>
              <AccessGate>
                <ActivityTracker />
                <WarmTabs />
                <StoreListingMeta />
                <Toaster />
              <Sonner />
              <MotionRoot>
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/waitlist" element={<Waitlist />} />
                <Route path="/home" element={<Navigate to="/feed" replace />} />
                <Route path="/landing" element={<Navigate to="/" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/locked" element={<Locked />} />
                <Route path="/denied" element={<Denied />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/directory" element={<Directory />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/events" element={<Navigate to="/calendar" replace />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/id" element={<EtherId />} />
                <Route path="/id/v/:token" element={<EtherIdVerify />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/profile/:userId" element={<Profile />} />
                <Route path="/blog" element={<BlogIndex />} />
                <Route path="/blog/:blogId" element={<BlogPostPage />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/store" element={<Store />} />
                <Route path="/mall" element={<Mall />} />
                <Route path="/nuance" element={<Nuance />} />
                <Route path="/fund" element={<FundDashboard />} />
                <Route path="/membership" element={<Membership />} />
                <Route path="/live" element={<Live />} />
                <Route path="/live/:streamId" element={<PublicLivePage />} />
                <Route path="/product/:itemId" element={<PublicProductPage />} />
                <Route path="/book" element={<BookOfLcove />} />
                <Route path="/quests" element={<QuestLog />} />
                <Route path="/cinema" element={<Cinema />} />
                <Route path="/cinema/network/:networkId" element={<NetworkPage />} />
                <Route path="/cinema/manage/:networkId" element={<NetworkManage />} />
                <Route path="/partners" element={<Partners />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/onboarding" element={<AdminOnboarding />} />
                <Route path="/admin/onboarding/:userId" element={<AdminOnboarding />} />
                <Route path="/community" element={<Community />} />
                <Route path="/settings/booking" element={<BookingSettings />} />
                <Route path="/book/:slug" element={<PublicBookingPage />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/today" element={<Today />} />
                <Route path="/boards" element={<Boards />} />
                <Route path="/boards/:boardId" element={<BoardEditor />} />
                <Route path="/sign-contract/:contractId" element={<SignContract />} />
                <Route path="/portfolios" element={<Portfolios />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/guidelines" element={<Guidelines />} />
                <Route path="/brand-partners" element={<BrandPartners />} />
                <Route path="/partner-portal" element={<PartnerPortal />} />
                <Route path="/collectives" element={<Collectives />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/dashboard/events" element={<HostHome />} />
                <Route path="/dashboard/events/calendar" element={<EventsDashboard />} />
                <Route path="/dashboard/events/finances" element={<HostFinance />} />
                <Route path="/dashboard/events/door" element={<HostDoor />} />
                <Route path="/dashboard/events/new" element={<HostEventEditor />} />
                <Route path="/dashboard/events/:eventId/edit" element={<HostEventEditor />} />
                <Route path="/dashboard/events/:eventId" element={<EventDetail />} />
                <Route path="/e/:eventId" element={<PublicEventPage />} />
                <Route path="/e/:eventId/tickets" element={<EventTickets />} />
                <Route path="/e/:eventId/checkout" element={<EventCheckout />} />
                <Route path="/e/:eventId/confirmation" element={<EventConfirmation />} />
                <Route path="/event/:eventId" element={<PublicEventPage />} />
                {HostingShots && <Route path="/preview/hosting" element={<HostingShots />} />}
                <Route path="/event/:eventId/tickets" element={<EventTickets />} />
                <Route path="/event/:eventId/checkout" element={<EventCheckout />} />
                <Route path="/event/:eventId/confirmation" element={<EventConfirmation />} />
                <Route path="/project/:projectId" element={<PublicProjectPage />} />
                <Route path="/client/:token" element={<PublicClientPortal />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              </MotionRoot>
              </AccessGate>
            </CreateFlowProvider>
          </PresenceProvider>
        </AuthProvider>
        <EtherSplash />
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
