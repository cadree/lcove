import { Eye, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { revealMotion } from "@/lib/reveal";

const trustPoints = [
  { icon: UserPlus, title: "Free to join" },
  { icon: Eye, title: "Privacy controls" },
];

export function TrustSection() {
  return (
    <section className="py-12 md:py-16">
      <div className="container px-4 sm:px-6 lg:px-8">
        <motion.div
          {...revealMotion({ y: 20 })}
          className="border border-border p-6 md:p-8"
        >
          <p className="eyebrow text-center mb-2">Joining</p>
          <h2 className="ether-title text-3xl text-center mb-6">
            Free to join
          </h2>
          
          <div className="flex justify-center gap-6 md:gap-10 flex-wrap">
            {trustPoints.map((point, index) => (
              <motion.div
                key={point.title}
                {...revealMotion({ scale: 0.9, duration: 0.3, delay: index * 0.05 })}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <point.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{point.title}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
