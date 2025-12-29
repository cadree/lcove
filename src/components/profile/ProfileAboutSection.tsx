import { motion } from 'framer-motion';
import { Crown, Star, Heart, Plus, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ProfileAboutSectionProps {
  bio: string;
  creativeRoles: Array<{ id: string; name: string }>;
  skills: Array<{ id: string; name: string }>;
  passions: Array<{ id: string; name: string }>;
  isOwner: boolean;
  onEditClick: () => void;
}

export function ProfileAboutSection({
  bio,
  creativeRoles,
  skills,
  passions,
  isOwner,
  onEditClick,
}: ProfileAboutSectionProps) {
  const hasDetails = creativeRoles.length > 0 || skills.length > 0 || passions.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="px-5 py-4"
    >
      {/* Bio */}
      <p className="text-muted-foreground leading-relaxed text-sm">{bio}</p>

      {/* Details Section */}
      {(hasDetails || isOwner) && (
        <div className="mt-5 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-medium text-foreground">About Me</h3>
            {isOwner && (
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onEditClick}>
                <Edit className="w-3.5 h-3.5 mr-1" />
                Edit
              </Button>
            )}
          </div>

          {/* Creative Roles */}
          {creativeRoles.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Crown className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Roles</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {creativeRoles.map((role) => (
                  <Badge 
                    key={role.id} 
                    variant="default" 
                    className="bg-primary/15 text-primary border-primary/20 text-xs font-medium"
                  >
                    {role.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Star className="w-3.5 h-3.5 text-accent-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Skills</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <Badge 
                    key={skill.id} 
                    variant="secondary" 
                    className="bg-accent/20 text-accent-foreground border-accent/20 text-xs"
                  >
                    {skill.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Passions */}
          {passions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Heart className="w-3.5 h-3.5 text-destructive" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Passions</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {passions.map((passion) => (
                  <Badge 
                    key={passion.id} 
                    variant="outline" 
                    className="border-muted-foreground/20 text-muted-foreground text-xs"
                  >
                    {passion.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Empty state for owner */}
          {isOwner && !hasDetails && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                Add your roles, skills, and passions
              </p>
              <Button variant="outline" size="sm" onClick={onEditClick}>
                <Plus className="w-4 h-4 mr-1" />
                Add Details
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
