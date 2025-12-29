import { motion } from "framer-motion";
import { ChevronRight, LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface HomeListRowProps {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: LucideIcon;
  link: string;
  index?: number;
}

const HomeListRow = ({ title, subtitle, meta, icon: Icon, link, index = 0 }: HomeListRowProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link to={link}>
        <motion.div 
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-accent/30 group"
        >
          {/* Icon */}
          {Icon && (
            <div className="w-10 h-10 rounded-xl glass flex items-center justify-center flex-shrink-0 border border-border/50 group-hover:border-primary/20 transition-colors">
              <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          )}
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
          
          {/* Meta & Arrow */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {meta && (
              <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {meta}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-0.5" />
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
};

export default HomeListRow;
