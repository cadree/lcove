import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoreMenuButton } from "@/components/navigation/MoreMenu";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  showBack?: boolean;
  showMore?: boolean;
  backPath?: string;
  className?: string;
}

export const PageHeader = ({
  title,
  description,
  eyebrow,
  icon,
  actions,
  showBack = true,
  showMore = true,
  backPath,
  className = "",
}: PageHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/feed");
    }
  };

  return (
    <header
      className={cn("pb-4 mb-6 border-b border-border", className)}
      role="banner"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {showBack && (
            <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0" aria-label="Go back">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <div className="flex items-center gap-2 min-w-0">
              {icon && <span className="shrink-0 text-foreground" aria-hidden="true">{icon}</span>}
              <h1 className="ether-title text-2xl sm:text-3xl truncate">{title}</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions && <nav className="flex items-center gap-2" aria-label="Page actions">{actions}</nav>}
          {showMore && <MoreMenuButton />}
        </div>
      </div>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
    </header>
  );
};
