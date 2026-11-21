import { motion } from "framer-motion";
import { revealMotion } from "@/lib/reveal";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface WidgetSectionHeaderProps {
  title: string;
  link?: string;
  linkText?: string;
}

const WidgetSectionHeader = ({ title, link, linkText = "See all" }: WidgetSectionHeaderProps) => {
  return (
    <motion.div
      {...revealMotion({ x: -8, duration: 0.3 })}
      className="flex items-center justify-between px-4 mb-3"
    >
      <h2 className="font-display text-base font-semibold text-foreground">
        {title}
      </h2>
      
      {link && (
        <Link 
          to={link}
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary transition-colors group"
        >
          {linkText}
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </motion.div>
  );
};

export default WidgetSectionHeader;
