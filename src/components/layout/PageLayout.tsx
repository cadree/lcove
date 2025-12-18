import { ReactNode } from "react";
import BottomNav from "@/components/navigation/BottomNav";
import { NotificationBell } from "@/components/notifications/NotificationBell";
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
  return <div className="min-h-screen bg-background">
      {/* Subtle ambient gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
      
      {/* Notification Bell - top right corner when logged in */}
      {user && showNotificationBell && !hideNav}
      
      <main className={`relative ${hideNav ? '' : 'pb-28'} ${className}`}>
        {children}
      </main>
      
      {!hideNav && <BottomNav />}
    </div>;
};
export default PageLayout;