import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Plus, Users, Clock, MapPin, DollarSign, Coins } from "lucide-react";

const projects = [
  {
    id: 1,
    title: "Music Video Production",
    description: "Looking for a director and DP for an indie artist music video shoot in downtown LA.",
    roles: ["Director", "DP", "Editor"],
    location: "Los Angeles",
    compensation: "Paid + Credits",
    deadline: "Dec 30",
    applicants: 12,
    status: "open",
  },
  {
    id: 2,
    title: "Brand Identity Redesign",
    description: "Sustainable fashion brand seeking full rebrand including logo, guidelines, and collateral.",
    roles: ["Brand Designer", "Strategist"],
    location: "Remote",
    compensation: "Paid",
    deadline: "Jan 15",
    applicants: 8,
    status: "open",
  },
  {
    id: 3,
    title: "Album Artwork Series",
    description: "Creating visual artwork for a 12-track electronic album release.",
    roles: ["Illustrator", "Motion Designer"],
    location: "New York",
    compensation: "Credits",
    deadline: "Jan 5",
    applicants: 23,
    status: "open",
  },
  {
    id: 4,
    title: "Documentary Short",
    description: "15-minute documentary about underground music scene. Need sound designer and colorist.",
    roles: ["Sound Designer", "Colorist"],
    location: "Chicago",
    compensation: "Hybrid",
    deadline: "Feb 1",
    applicants: 6,
    status: "open",
  },
];

const Projects = () => {
  return (
    <PageLayout>
      <div className="px-6 pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-8"
        >
          <div>
            <h1 className="font-display text-3xl font-medium text-foreground mb-2">Projects</h1>
            <p className="text-muted-foreground">Find collaborators or post your own project call</p>
          </div>
          <Button variant="pink" size="lg" className="hidden sm:flex">
            <Plus className="w-4 h-4" />
            Post Project
          </Button>
        </motion.div>

        {/* Mobile CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="sm:hidden mb-6"
        >
          <Button variant="pink" className="w-full">
            <Plus className="w-4 h-4" />
            Post Project Call
          </Button>
        </motion.div>

        {/* Projects List */}
        <div className="space-y-4">
          {projects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="glass-strong rounded-2xl p-6 hover:bg-accent/20 transition-all duration-300 cursor-pointer"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-display text-xl font-medium text-foreground mb-2">
                    {project.title}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {project.description}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium flex-shrink-0">
                  Open
                </span>
              </div>

              {/* Roles */}
              <div className="flex flex-wrap gap-2 mb-4">
                {project.roles.map((role) => (
                  <span
                    key={role}
                    className="px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-sm"
                  >
                    {role}
                  </span>
                ))}
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {project.location}
                </div>
                <div className="flex items-center gap-1">
                  {project.compensation.includes("Paid") ? (
                    <DollarSign className="w-4 h-4" />
                  ) : (
                    <Coins className="w-4 h-4" />
                  )}
                  {project.compensation}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {project.deadline}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {project.applicants} applied
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State (when no projects) */}
        {projects.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-lg mb-2">No project calls yet</p>
            <p className="text-muted-foreground/70 text-sm mb-6">
              Be the first to post a collaboration opportunity
            </p>
            <Button variant="pink">Post Your First Project</Button>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
};

export default Projects;
