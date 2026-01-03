import { 
  Image, 
  FolderKanban, 
  CalendarDays, 
  Store, 
  FileSignature, 
  Radio,
  MessageCircle,
  Users,
  Video,
  Wallet
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

const benefits = [
  { icon: Image, title: "Post & Share" },
  { icon: FolderKanban, title: "Projects" },
  { icon: CalendarDays, title: "Events" },
  { icon: Store, title: "Store" },
  { icon: FileSignature, title: "Contracts" },
  { icon: Radio, title: "Live" },
  { icon: MessageCircle, title: "Messages" },
  { icon: Users, title: "Community" },
  { icon: Video, title: "Cinema" },
  { icon: Wallet, title: "Wallet" },
];

export function BenefitsCarousel() {
  return (
    <section className="py-12 md:py-16">
      <div className="container px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h2 className="font-display text-2xl sm:text-3xl font-medium">
            Everything you need to <span className="text-gradient">thrive</span>
          </h2>
        </motion.div>

        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          className="w-full"
        >
          <CarouselContent className="-ml-2 md:-ml-4">
            {benefits.map((benefit, index) => (
              <CarouselItem key={benefit.title} className="pl-2 md:pl-4 basis-1/4 sm:basis-1/5 md:basis-1/6 lg:basis-[12.5%]">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex flex-col items-center gap-2 p-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground text-center">
                    {benefit.title}
                  </span>
                </motion.div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  );
}
