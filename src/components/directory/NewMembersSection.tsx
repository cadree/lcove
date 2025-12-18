import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MapPin } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
  created_at: string | null;
}

interface NewMembersSectionProps {
  profiles: Profile[];
}

export function NewMembersSection({ profiles }: NewMembersSectionProps) {
  const navigate = useNavigate();
  
  // Get members who joined in the last 14 days
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  
  const newMembers = profiles
    .filter(p => p.created_at && new Date(p.created_at) > twoWeeksAgo)
    .slice(0, 10);

  if (newMembers.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mb-8"
    >
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-lg font-medium text-foreground">New to the Community</h2>
          <p className="text-xs text-muted-foreground">Welcome them and help them feel at home</p>
        </div>
      </div>

      {/* Horizontal Scrollable Members */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
        {newMembers.map((member, index) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + index * 0.05 }}
            onClick={() => navigate(`/profile/${member.user_id}`)}
            className="flex-shrink-0 w-32 glass-strong rounded-xl p-4 hover:bg-accent/20 transition-all cursor-pointer group text-center"
          >
            <div className="relative mx-auto mb-3">
              <Avatar className="w-16 h-16 mx-auto border-2 border-primary/30 group-hover:border-primary transition-colors">
                <AvatarImage src={member.avatar_url || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground text-lg font-medium">
                  {member.display_name?.charAt(0).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <Badge 
                variant="default" 
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0 h-5"
              >
                New
              </Badge>
            </div>
            <h3 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
              {member.display_name || 'Anonymous'}
            </h3>
            {member.city && (
              <p className="text-xs text-muted-foreground truncate flex items-center justify-center gap-1 mt-1">
                <MapPin className="w-2.5 h-2.5" />
                {member.city}
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
