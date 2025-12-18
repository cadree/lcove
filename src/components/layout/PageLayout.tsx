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
      <main className={`${hideNav ? '' : 'pb-28'} ${className}`}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
};

export default PageLayout;
