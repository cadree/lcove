import { ReactNode } from "react";
import { BackButton } from "@/components/navigation/BackButton";
import { MoreMenuButton } from "@/components/navigation/MoreMenu";
import { glyphColor, iconFills, type IconFill } from "@/components/world/SquircleIcon";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  tile?: IconFill;
  actions?: ReactNode;
  showBack?: boolean;
  showMore?: boolean;
  className?: string;
}

export const PageHeader = ({
  title,
  description,
  eyebrow,
  icon,
  tile = "pink",
  actions,
  showBack = true,
  showMore = true,
  className = "",
}: PageHeaderProps) => {
  return (
    <header
      className={cn("pb-4 mb-6 border-b border-border", className)}
      role="banner"
    >
      <div className="flex items-start gap-2">
        {showBack && <BackButton label="Go back" className="shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="kicker">// {eyebrow || "Archive"}</p>
          <div className="mt-1 flex items-center gap-2 min-w-0">
            {icon && (
              <span
                className="squircle-icon shrink-0 [&_svg]:!h-[18px] [&_svg]:!w-[18px] [&_svg]:!text-current"
                style={{ width: 34, height: 34, backgroundImage: iconFills[tile], color: glyphColor(tile) }}
                aria-hidden="true"
              >
                {icon}
              </span>
            )}
            <h1 className="ether-title text-[34px] leading-tight">{title}</h1>
          </div>
        </div>
        {showMore && <MoreMenuButton />}
      </div>
      {actions && (
        <nav className="mt-3 flex flex-wrap items-center gap-2" aria-label="Page actions">{actions}</nav>
      )}
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
    </header>
  );
};
