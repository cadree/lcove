import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  showBack?: boolean;
  backPath?: string;
  className?: string;
}
export const PageHeader = ({
  title,
  description,
  icon,
  actions,
  showBack = true,
  backPath,
  className = ""
}: PageHeaderProps) => {
  const navigate = useNavigate();
  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/home');
    }
  };
  return <motion.header initial={{
    opacity: 0,
    y: -20
  }} animate={{
    opacity: 1,
    y: 0
  }} transition={{
    duration: 0.5
  }} className={`flex items-center justify-between mb-6 ${className}`} role="banner">
      <div className="flex items-center gap-3">
        {showBack && <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0" aria-label="Go back">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Button>}
        {icon && <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0" aria-hidden="true">
            {icon}
          </div>}
        <div>
          
          {description}
        </div>
      </div>
      {actions && <nav className="flex items-center gap-2" aria-label="Page actions">
          {actions}
        </nav>}
    </motion.header>;
};