import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface WidgetMiniCardProps {
  title: string;
  subtitle?: string;
  tag?: string;
  icon: LucideIcon;
  link: string;
  index?: number;
}

const WidgetMiniCard = ({ title, subtitle, tag, icon: Icon, link, index = 0 }: WidgetMiniCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link to={link}>
        <motion.div 
          whileTap={{ scale: 0.97 }}
          className="relative overflow-hidden rounded-[18px] glass h-[115px] p-4 flex flex-col justify-between transition-all duration-300 hover:bg-accent/30 group"
        >
          {/* Subtle glow on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/8 rounded-full blur-2xl" />
          </div>
          
          {/* Content */}
          <div className="relative z-10 space-y-1">
            {tag && (
              <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-[9px] uppercase tracking-wider text-primary font-medium">
                {tag}
              </span>
            )}
            <h3 className="font-medium text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {subtitle}
              </p>
            )}
          </div>
          
          {/* Icon */}
          <div className="relative z-10 self-end">
            <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
};

export default WidgetMiniCard;
