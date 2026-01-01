import { motion } from "framer-motion";
import { usePlatformStats } from "@/hooks/usePlatformStats";

export function StatsRow() {
  const { data: stats, isLoading } = usePlatformStats();

  const displayStats = [
    { 
      label: "Creators", 
      value: isLoading ? "..." : (stats?.totalCreatives?.toLocaleString() || "2,400+")
    },
    { 
      label: "Projects", 
      value: isLoading ? "..." : (stats?.totalProjects?.toLocaleString() || "850+")
    },
    { 
      label: "Cities", 
      value: isLoading ? "..." : (stats?.totalCities?.toLocaleString() || "150+")
    },
    { 
      label: "Events", 
      value: "500+"
    },
  ];

  return (
    <section className="py-16 md:py-20 border-y border-border/30">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {displayStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="font-display text-4xl sm:text-5xl lg:text-6xl font-medium text-gradient-pink mb-2">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
