import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import {
  Settings,
  MapPin,
  Link as LinkIcon,
  Instagram,
  Music,
  Calendar,
  Store,
  Coins,
  Edit,
  Plus,
} from "lucide-react";

const profileData = {
  name: "Maya Chen",
  role: "Digital Artist & Motion Designer",
  city: "Los Angeles",
  avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop",
  coverImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=400&fit=crop",
  bio: "Creating immersive digital experiences at the intersection of art and technology. Focused on generative systems and interactive installations.",
  credits: 450,
  projectsCompleted: 23,
  eventsHosted: 5,
  links: {
    website: "mayachen.art",
    instagram: "@mayachen.art",
  },
  skills: ["3D Art", "Motion Design", "Creative Coding", "Illustration", "TouchDesigner"],
  portfolio: [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1633218388467-539651dcf81a?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1634017839464-5c339bbe3c98?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1635322966219-b75ed372eb01?w=400&h=400&fit=crop",
  ],
};

const Profile = () => {
  return (
    <PageLayout>
      <div className="min-h-screen">
        {/* Cover Image */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative h-48 sm:h-64 bg-cover bg-center"
          style={{ backgroundImage: `url(${profileData.coverImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          
          {/* Settings Button */}
          <Button
            variant="glass"
            size="icon"
            className="absolute top-4 right-4"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </motion.div>

        <div className="px-6 -mt-16 relative z-10">
          {/* Avatar & Basic Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-start gap-4 mb-6"
          >
            {/* Avatar */}
            <div
              className="w-28 h-28 rounded-2xl bg-cover bg-center border-4 border-background shadow-lg"
              style={{ backgroundImage: `url(${profileData.avatar})` }}
            />

            {/* Info */}
            <div className="flex-1 pt-2">
              <h1 className="font-display text-2xl sm:text-3xl font-medium text-foreground mb-1">
                {profileData.name}
              </h1>
              <p className="text-muted-foreground mb-2">{profileData.role}</p>
              <p className="text-sm text-muted-foreground/70 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {profileData.city}
              </p>
            </div>

            {/* Edit Button */}
            <Button variant="outline" className="hidden sm:flex">
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-3 gap-4 mb-8"
          >
            <div className="glass-strong rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Coins className="w-4 h-4 text-primary" />
                <span className="font-display text-xl font-medium text-foreground">
                  {profileData.credits}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">LC Credits</span>
            </div>
            <div className="glass-strong rounded-xl p-4 text-center">
              <span className="font-display text-xl font-medium text-foreground block mb-1">
                {profileData.projectsCompleted}
              </span>
              <span className="text-xs text-muted-foreground">Projects</span>
            </div>
            <div className="glass-strong rounded-xl p-4 text-center">
              <span className="font-display text-xl font-medium text-foreground block mb-1">
                {profileData.eventsHosted}
              </span>
              <span className="text-xs text-muted-foreground">Events</span>
            </div>
          </motion.div>

          {/* Bio */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <h2 className="font-display text-lg font-medium text-foreground mb-3">About</h2>
            <p className="text-muted-foreground leading-relaxed">{profileData.bio}</p>
          </motion.div>

          {/* Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="flex flex-wrap gap-3 mb-8"
          >
            <Button variant="glass" size="sm">
              <LinkIcon className="w-4 h-4 mr-1" />
              {profileData.links.website}
            </Button>
            <Button variant="glass" size="sm">
              <Instagram className="w-4 h-4 mr-1" />
              {profileData.links.instagram}
            </Button>
          </motion.div>

          {/* Skills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <h2 className="font-display text-lg font-medium text-foreground mb-3">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {profileData.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Profile Blocks (Modular) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-medium text-foreground">Portfolio</h2>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {profileData.portfolio.map((image, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-xl bg-cover bg-center hover:opacity-80 transition-opacity cursor-pointer"
                  style={{ backgroundImage: `url(${image})` }}
                />
              ))}
            </div>
          </motion.div>

          {/* Additional Blocks (Preview) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-2 gap-4 mb-8"
          >
            <div className="glass-strong rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/20 transition-colors">
              <Store className="w-6 h-6 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Add Store</span>
            </div>
            <div className="glass-strong rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/20 transition-colors">
              <Calendar className="w-6 h-6 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Add Events</span>
            </div>
            <div className="glass-strong rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/20 transition-colors">
              <Music className="w-6 h-6 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Connect Music</span>
            </div>
            <div className="glass-strong rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-accent/20 transition-colors">
              <Plus className="w-6 h-6 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Add Block</span>
            </div>
          </motion.div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Profile;
