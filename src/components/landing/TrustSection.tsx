import { Shield, CreditCard, Eye, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const trustPoints = [
  {
    icon: Shield,
    title: "Enterprise-grade security",
    description: "Your data is encrypted and protected with industry-leading security standards.",
  },
  {
    icon: CreditCard,
    title: "Secure payments via Stripe",
    description: "Accept payments confidently with Stripe's trusted payment infrastructure.",
  },
  {
    icon: Eye,
    title: "You control your visibility",
    description: "Customize who sees your work and manage your notification preferences.",
  },
  {
    icon: FileText,
    title: "Clear community guidelines",
    description: "We maintain a respectful, professional environment for all creators.",
  },
];

export function TrustSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="glass-subtle rounded-3xl p-8 md:p-12"
        >
          <div className="text-center mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-medium mb-3">
              Built on trust & transparency
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Your security and privacy are our top priorities.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trustPoints.map((point, index) => (
              <motion.div
                key={point.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                className="text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <point.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium text-sm mb-1">{point.title}</h3>
                <p className="text-xs text-muted-foreground">{point.description}</p>
              </motion.div>
            ))}
          </div>
          
          <div className="text-center mt-8">
            <Link 
              to="/community" 
              className="text-sm text-primary hover:underline"
            >
              Read our community guidelines →
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
