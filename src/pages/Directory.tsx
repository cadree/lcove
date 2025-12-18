import { useState } from "react";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Briefcase, Filter, Users } from "lucide-react";

const creatives = [
  {
    id: 1,
    name: "Maya Chen",
    role: "Digital Artist",
    city: "Los Angeles",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    skills: ["3D Art", "Motion Design", "Illustration"],
    available: true,
  },
  {
    id: 2,
    name: "James Wright",
    role: "Photographer",
    city: "New York",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    skills: ["Portrait", "Editorial", "Fashion"],
    available: true,
  },
  {
    id: 3,
    name: "Luna Rodriguez",
    role: "Music Producer",
    city: "Miami",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
    skills: ["Mixing", "Sound Design", "Vocals"],
    available: false,
  },
  {
    id: 4,
    name: "Alex Kim",
    role: "Brand Designer",
    city: "San Francisco",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
    skills: ["Branding", "Typography", "Strategy"],
    available: true,
  },
  {
    id: 5,
    name: "Sofia Martinez",
    role: "Filmmaker",
    city: "Austin",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop",
    skills: ["Documentary", "Music Videos", "Direction"],
    available: true,
  },
  {
    id: 6,
    name: "Jordan Cole",
    role: "Musician",
    city: "Chicago",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    skills: ["Production", "Guitar", "Songwriting"],
    available: false,
  },
];

const Directory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("All Cities");

  const filteredCreatives = creatives.filter((creative) => {
    const matchesSearch = creative.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creative.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creative.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCity = selectedCity === "All Cities" || creative.city === selectedCity;
    return matchesSearch && matchesCity;
  });

  const cities = ["All Cities", ...new Set(creatives.map(c => c.city))];

  return (
    <PageLayout>
      <div className="px-6 pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl font-medium text-foreground mb-2">Directory</h1>
          <p className="text-muted-foreground">Find creatives by skill, city, or role</p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative mb-6"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, role, or skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-14 pl-12 pr-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </motion.div>

        {/* City Filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide"
        >
          {cities.map((city) => (
            <Button
              key={city}
              variant={selectedCity === city ? "default" : "glass"}
              size="sm"
              onClick={() => setSelectedCity(city)}
              className="whitespace-nowrap"
            >
              <MapPin className="w-3 h-3 mr-1" />
              {city}
            </Button>
          ))}
        </motion.div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCreatives.map((creative, index) => (
            <motion.div
              key={creative.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="glass-strong rounded-2xl p-5 hover:bg-accent/20 transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className="w-16 h-16 rounded-xl bg-cover bg-center flex-shrink-0 border-2 border-border group-hover:border-primary/50 transition-colors"
                  style={{ backgroundImage: `url(${creative.avatar})` }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display text-lg font-medium text-foreground truncate">
                      {creative.name}
                    </h3>
                    {creative.available && (
                      <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    {creative.role}
                  </p>
                  <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {creative.city}
                  </p>
                </div>
              </div>

              {/* Skills */}
              <div className="flex flex-wrap gap-2 mt-4">
                {creative.skills.slice(0, 3).map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-1 rounded-md bg-accent/50 text-xs text-accent-foreground"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredCreatives.length === 0 && (
          <EmptyState
            icon={Users}
            title="No creatives found"
            description={searchQuery 
              ? "Try adjusting your search or exploring a different city. The right connection might be just around the corner."
              : "Be the first to join this creative community in your city."}
            secondaryAction={searchQuery ? {
              label: "Clear Search",
              onClick: () => {
                setSearchQuery("");
                setSelectedCity("All Cities");
              }
            } : undefined}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default Directory;
