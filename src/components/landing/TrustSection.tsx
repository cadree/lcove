import { Shield, CreditCard, Eye, FileText } from "lucide-react";
import { motion } from "framer-motion";

const trustPoints = [
  { icon: Shield, title: "Enterprise security" },
  { icon: CreditCard, title: "Secure payments" },
  { icon: Eye, title: "Privacy control" },
  { icon: FileText, title: "Clear guidelines" },
];

export function TrustSection() {
  return (
    <section className="py-12 md:py-16">
      <div className="container px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="glass-subtle rounded-2xl p-6 md:p-8"
        >
          <h2 className="font-display text-xl sm:text-2xl font-medium text-center mb-6">
            Built on trust & transparency
          </h2>
          
          <div className="flex justify-center gap-6 md:gap-10 flex-wrap">
            {trustPoints.map((point, index) => (
              <motion.div
                key={point.title}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
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
