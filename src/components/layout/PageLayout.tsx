import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import BottomNav from "@/components/navigation/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

const MAIN_TABS = ["/feed", "/explore", "/messages", "/profile"];

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  hideNav?: boolean;
  showNotificationBell?: boolean;
}

const PageLayout = ({
  children,
  className = "",
  hideNav = false,
  showNotificationBell = true
}: PageLayoutProps) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const onMainTab = MAIN_TABS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <main className={`relative safe-area-top ${hideNav ? "safe-area-bottom" : "pb-28"} ${className}`}>
        {children}
      </main>
      
      {!hideNav && (user || onMainTab) && <BottomNav />}
    </div>
  );
};

export default PageLayout;