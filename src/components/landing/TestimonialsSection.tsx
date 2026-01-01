import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Quote } from "lucide-react";
import { motion } from "framer-motion";

const testimonials = [
  {
    quote: "Ether changed how I connect with other creatives. No algorithm nonsense—just real people and real collaborations.",
    author: "Maya Chen",
    role: "Photographer, NYC",
    avatar: "",
  },
  {
    quote: "I've booked more clients through Ether in 3 months than I did on Instagram in a year. The contracts feature is a game-changer.",
    author: "Jordan Brooks",
    role: "Videographer, LA",
    avatar: "",
  },
  {
    quote: "Finally, a platform that treats creators like professionals. The project tools are exactly what our collective needed.",
    author: "Sam Rivera",
    role: "Creative Director, Miami",
    avatar: "",
  },
  {
    quote: "The community here is different. Everyone wants to help each other succeed. It feels like a real creative family.",
    author: "Alex Thompson",
    role: "Musician, Austin",
    avatar: "",
  },
];

const logos = [
  { name: "Creative Weekly", initials: "CW" },
  { name: "Design Daily", initials: "DD" },
  { name: "Art Review", initials: "AR" },
  { name: "The Creator Hub", initials: "CH" },
];

export function TestimonialsSection() {
  return (
    <section className="py-20 md:py-32">
      <div className="container px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium mb-4">
            Loved by <span className="text-gradient-pink">creators</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join thousands of creatives who've found their home on Ether.
          </p>
        </motion.div>

        {/* Testimonial Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-16"
        >
          <Carousel className="w-full max-w-4xl mx-auto">
            <CarouselContent>
              {testimonials.map((testimonial, index) => (
                <CarouselItem key={index} className="md:basis-1/2">
                  <Card className="h-full card-premium">
                    <CardContent className="p-6 lg:p-8">
                      <Quote className="w-8 h-8 text-primary/30 mb-4" />
                      <p className="text-foreground mb-6 leading-relaxed">
                        "{testimonial.quote}"
                      </p>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={testimonial.avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {testimonial.author.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{testimonial.author}</div>
                          <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-12" />
            <CarouselNext className="hidden md:flex -right-12" />
          </Carousel>
        </motion.div>

        {/* As Seen In */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center"
        >
          <p className="text-sm text-muted-foreground mb-6">As featured in</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {logos.map((logo) => (
              <div 
                key={logo.name} 
                className="w-20 h-12 rounded-lg glass-subtle flex items-center justify-center"
              >
                <span className="text-lg font-display text-muted-foreground">{logo.initials}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
