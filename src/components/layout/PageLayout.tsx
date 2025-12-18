import { ReactNode } from "react";
import BottomNav from "@/components/navigation/BottomNav";

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  hideNav?: boolean;
}

const PageLayout = ({ children, className = "", hideNav = false }: PageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Subtle ambient gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
      
      <main className={`relative ${hideNav ? '' : 'pb-28'} ${className}`}>
        {children}
      </main>
      
      {!hideNav && <BottomNav />}
    </div>
  );
};

export default PageLayout;
