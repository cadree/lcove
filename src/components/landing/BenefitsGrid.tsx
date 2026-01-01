import { 
  Image, 
  FolderKanban, 
  CalendarDays, 
  Store, 
  FileSignature, 
  Radio 
} from "lucide-react";
import { motion } from "framer-motion";

const benefits = [
  {
    icon: Image,
    title: "Post & Share",
    description: "Share photos, videos, and collages with the community. No likes, no pressure—just your work.",
  },
  {
    icon: FolderKanban,
    title: "Project Collaboration",
    description: "Find collaborators, manage roles, and track milestones from concept to completion.",
  },
  {
    icon: CalendarDays,
    title: "Events & Calendar",
    description: "Schedule sessions, host events, and stay synced with your creative circle.",
  },
  {
    icon: Store,
    title: "Creator Store",
    description: "Sell services, digital goods, and experiences directly to your audience.",
  },
  {
    icon: FileSignature,
    title: "Contracts & E-Sign",
    description: "Generate contracts, send invoices, and collect signatures—all in one place.",
  },
  {
    icon: Radio,
    title: "Real-Time Updates",
    description: "Live activity feeds, instant notifications, and always-on connection to your community.",
  },
];

export function BenefitsGrid() {
  return (
    <section className="py-20 md:py-32 relative">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/20 to-transparent" />
      
      <div className="container relative px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium mb-4">
            Everything you need to <span className="text-gradient">thrive</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A complete toolkit designed for modern creators—no more juggling apps.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="group p-6 lg:p-8 rounded-2xl glass-subtle hover:glass transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <benefit.icon className="w-6 h-6 text-primary" />
              </div>
              
              <h3 className="font-display text-xl font-medium mb-2">{benefit.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{benefit.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
