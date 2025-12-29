import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

interface HomeSectionHeaderProps {
  title: string;
  subtitle?: string;
  link?: string;
  linkText?: string;
}

const HomeSectionHeader = ({ title, subtitle, link, linkText = "View all" }: HomeSectionHeaderProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="flex items-end justify-between px-4 mb-3"
    >
      <div className="space-y-0.5">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      
      {link && (
        <Link 
          to={link}
          className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors group"
        >
          {linkText}
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </motion.div>
  );
};

export default HomeSectionHeader;
