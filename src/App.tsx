// Application entry point - Ether App
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NavCustomizationProvider } from "@/hooks/useNavCustomization";
import { PresenceProvider } from "@/hooks/usePresence";
import AccessGate from "@/components/auth/AccessGate";
import { useTrackActivity } from "@/hooks/useTrackActivity";

const Index = lazy(() => import("./pages/Index"));
const Landing = lazy(() => import("./pages/Landing"));
const Feed = lazy(() => import("./pages/Feed"));
const Directory = lazy(() => import("./pages/Directory"));
const Projects = lazy(() => import("./pages/Projects"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const Profile = lazy(() => import("./pages/Profile"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Locked = lazy(() => import("./pages/Locked"));
const Messages = lazy(() => import("./pages/Messages"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Store = lazy(() => import("./pages/Store"));
const Mall = lazy(() => import("./pages/Mall"));
const FundDashboard = lazy(() => import("./pages/FundDashboard"));
const Membership = lazy(() => import("./pages/Membership"));
const Live = lazy(() => import("./pages/Live"));
const Settings = lazy(() => import("./pages/Settings"));
const BookOfLcove = lazy(() => import("./pages/BookOfLcove"));
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
const PublicEventPage = lazy(() => import("./pages/PublicEventPage"));
const EventConfirmation = lazy(() => import("./pages/EventConfirmation"));
const PublicProjectPage = lazy(() => import("./pages/PublicProjectPage"));
const PublicClientPortal = lazy(() => import("@/pages/PublicClientPortal"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Nuance = lazy(() => import("./pages/Nuance"));

const ActivityTracker = () => {
  useTrackActivity();
  return null;
};

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
        <AuthProvider>
          <PresenceProvider>
            <NavCustomizationProvider>
              <AccessGate>
                <ActivityTracker />
                <Toaster />
              <Sonner />
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/home" element={<Index />} />
                <Route path="/landing" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/locked" element={<Locked />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/directory" element={<Directory />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/profile/:userId" element={<Profile />} />
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
                <Route path="/book" element={<BookOfLcove />} />
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
                <Route path="/dashboard/events" element={<EventsDashboard />} />
                <Route path="/dashboard/events/:eventId" element={<EventDetail />} />
                <Route path="/event/:eventId" element={<PublicEventPage />} />
                <Route path="/event/:eventId/confirmation" element={<EventConfirmation />} />
                <Route path="/project/:projectId" element={<PublicProjectPage />} />
                <Route path="/client/:token" element={<PublicClientPortal />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              </AccessGate>
            </NavCustomizationProvider>
          </PresenceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
