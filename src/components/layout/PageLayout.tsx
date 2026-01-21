import { ReactNode } from "react";
import BottomNav from "@/components/navigation/BottomNav";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalFAB } from "@/components/navigation/GlobalFAB";
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
  const {
    user
  } = useAuth();
  return <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Subtle ambient gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
      
      {/* Notification Bell - top right corner when logged in */}
      {user && showNotificationBell && !hideNav}
      
      <main className={`relative safe-area-top ${hideNav ? 'safe-area-bottom' : 'pb-28'} ${className}`}>
        {children}
      </main>
      
      {!hideNav && (
        <>
          <GlobalFAB />
          <BottomNav />
        </>
      )}
    </div>;
};
export default PageLayout;