import { motion } from "framer-motion";
import { usePlatformStats } from "@/hooks/usePlatformStats";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsRow() {
  const { data: stats, isLoading, isError } = usePlatformStats();

  const displayStats = [
    { label: "Creators", value: stats?.totalCreatives },
    { label: "Projects", value: stats?.totalProjects },
    { label: "Cities", value: stats?.totalCities },
    { label: "Events", value: stats?.totalEvents },
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
                {isLoading ? (
                  <Skeleton className="h-12 sm:h-14 lg:h-16 w-20 mx-auto bg-muted/20" />
                ) : isError ? (
                  "—"
                ) : (
                  stat.value?.toLocaleString() ?? "0"
                )}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
