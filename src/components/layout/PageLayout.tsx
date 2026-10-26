import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import BottomNav from "@/components/navigation/BottomNav";
import { NoviCelebration } from "@/components/novi/NoviCelebration";
import { useAuth } from "@/contexts/AuthContext";

const MAIN_TABS = ["/feed", "/explore", "/messages", "/profile"];

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  hideNav?: boolean;
  showNotificationBell?: boolean;
  bleed?: boolean;
}

const PageLayout = ({
  children,
  className = "",
  hideNav = false,
  showNotificationBell = true,
  bleed = false,
}: PageLayoutProps) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const onMainTab = MAIN_TABS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  
  return (
    <div className={`min-h-screen bg-background ${bleed ? "overflow-x-visible" : "overflow-x-hidden"}`}>
      <NoviCelebration />
      <main className={`relative safe-area-top ${hideNav ? "safe-area-bottom" : "pb-28"} ${className}`}>
        {children}
      </main>
      
      {!hideNav && (user || onMainTab) && <BottomNav />}
    </div>
  );
};

export default PageLayout;