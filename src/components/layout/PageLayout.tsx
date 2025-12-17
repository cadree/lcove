import { ReactNode } from "react";
import BottomNav from "@/components/navigation/BottomNav";

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
}

const PageLayout = ({ children, className = "" }: PageLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <main className={`pb-28 ${className}`}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
};

export default PageLayout;
