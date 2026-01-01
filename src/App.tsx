// Application entry point - Ether App
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NavCustomizationProvider } from "@/hooks/useNavCustomization";
import AccessGate from "@/components/auth/AccessGate";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Feed from "./pages/Feed";
import Directory from "./pages/Directory";
import Projects from "./pages/Projects";
import CalendarPage from "./pages/CalendarPage";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Locked from "./pages/Locked";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import Wallet from "./pages/Wallet";
import Store from "./pages/Store";
import Mall from "./pages/Mall";
import FundDashboard from "./pages/FundDashboard";
import Membership from "./pages/Membership";
import Live from "./pages/Live";
import Settings from "./pages/Settings";
import BookOfLcove from "./pages/BookOfLcove";
import NotFound from "./pages/NotFound";
import Cinema from "./pages/Cinema";
import NetworkPage from "./pages/NetworkPage";
import NetworkManage from "./pages/NetworkManage";
import Partners from "./pages/Partners";
import Admin from "./pages/Admin";
import AdminOnboarding from "./pages/AdminOnboarding";
import Community from "./pages/Community";
import BookingSettings from "./pages/BookingSettings";
import PublicBookingPage from "./pages/PublicBookingPage";
import Pipeline from "./pages/Pipeline";
import Today from "./pages/Today";
import Boards from "./pages/Boards";
import BoardEditor from "./pages/BoardEditor";
import SignContract from "./pages/SignContract";

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
          <NavCustomizationProvider>
            <AccessGate>
              <Toaster />
              <Sonner />
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
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AccessGate>
          </NavCustomizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
