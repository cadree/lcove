import { motion } from "framer-motion";

interface StatItem {
  value: string | number;
  label: string;
}

interface WidgetStatChipProps {
  stats: StatItem[];
}

const WidgetStatChip = ({ stats }: WidgetStatChipProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="flex justify-center gap-2 px-4 py-4"
    >
      {stats.map((stat, index) => (
        <div 
          key={stat.label}
          className="flex-1 max-w-[96px] h-16 glass rounded-2xl flex flex-col items-center justify-center"
        >
          <p className="font-display text-lg font-semibold text-foreground leading-none">
            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
          </p>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">
            {stat.label}
          </p>
        </div>
      ))}
    </motion.div>
  );
};

export default WidgetStatChip;
