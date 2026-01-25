import { ReactNode } from "react";
import { GlobalFAB } from "@/components/navigation/GlobalFAB";
import BottomNav from "@/components/navigation/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

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
  
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Subtle ambient gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
      
      <main className={`relative safe-area-top ${hideNav ? 'safe-area-bottom' : 'pb-28'} ${className}`}>
        {children}
      </main>
      
      {/* Bottom Navigation - visible on all pages when authenticated */}
      {!hideNav && user && <BottomNav />}
      
      {/* Global FAB for quick actions */}
      {!hideNav && <GlobalFAB />}
    </div>
  );
};

export default PageLayout;