import { motion } from "framer-motion";
import { ChevronRight, LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface WidgetListRowProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  link: string;
  index?: number;
}

const WidgetListRow = ({ title, subtitle, icon: Icon, link, index = 0 }: WidgetListRowProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Link to={link}>
        <motion.div 
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3 h-[58px] px-4 rounded-[18px] transition-colors hover:bg-accent/30 group"
        >
          {/* Icon */}
          {Icon && (
            <div className="w-10 h-10 rounded-xl glass flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
              <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          )}
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
          
          {/* Arrow */}
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-all group-hover:translate-x-0.5 flex-shrink-0" />
        </motion.div>
      </Link>
    </motion.div>
  );
};

export default WidgetListRow;
