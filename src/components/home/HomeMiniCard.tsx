import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface HomeMiniCardProps {
  title: string;
  label?: string;
  icon: LucideIcon;
  link: string;
  index?: number;
}

const HomeMiniCard = ({ title, label, icon: Icon, link, index = 0 }: HomeMiniCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link to={link}>
        <motion.div 
          whileTap={{ scale: 0.97 }}
          className="relative overflow-hidden rounded-2xl glass p-4 min-h-[100px] flex flex-col justify-between transition-all duration-300 hover:bg-accent/30 group"
        >
          {/* Subtle glow on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full blur-2xl" />
          </div>
          
          {/* Border */}
          <div className="absolute inset-0 rounded-2xl border border-border/50 group-hover:border-primary/20 transition-colors" />
          
          {/* Content */}
          <div className="relative z-10">
            {label && (
              <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-[10px] uppercase tracking-wider text-primary font-medium mb-2">
                {label}
              </span>
            )}
            <h3 className="font-medium text-sm text-foreground line-clamp-2">
              {title}
            </h3>
          </div>
          
          {/* Icon */}
          <div className="relative z-10 mt-2 self-end">
            <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
};

export default HomeMiniCard;
