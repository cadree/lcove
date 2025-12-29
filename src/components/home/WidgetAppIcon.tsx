import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface WidgetAppIconProps {
  title: string;
  icon: LucideIcon;
  link: string;
  badge?: number | string;
  index?: number;
}

const WidgetAppIcon = ({ title, icon: Icon, link, badge, index = 0 }: WidgetAppIconProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link to={link}>
        <motion.div 
          whileTap={{ scale: 0.92 }}
          className="flex flex-col items-center gap-1.5"
        >
          {/* Icon Container */}
          <div className="relative w-[76px] h-[76px] sm:w-[88px] sm:h-[88px] rounded-[18px] glass flex items-center justify-center transition-all duration-300 hover:bg-accent/40 group">
            {/* Badge */}
            {badge && (
              <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary flex items-center justify-center">
                <span className="text-[10px] font-medium text-primary-foreground">
                  {badge}
                </span>
              </div>
            )}
            
            <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          
          {/* Label */}
          <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[76px] sm:max-w-[88px]">
            {title}
          </span>
        </motion.div>
      </Link>
    </motion.div>
  );
};

export default WidgetAppIcon;
