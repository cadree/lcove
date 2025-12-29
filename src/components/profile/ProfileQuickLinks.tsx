import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, Calendar, Heart, Crown, BookOpen, FolderKanban, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileQuickLinksProps {
  isOwner: boolean;
}

export function ProfileQuickLinks({ isOwner }: ProfileQuickLinksProps) {
  if (!isOwner) return null;

  const links = [
    { to: '/store', icon: Store, label: 'My Store', color: 'text-muted-foreground' },
    { to: '/calendar', icon: Calendar, label: 'Events', color: 'text-muted-foreground' },
    { to: '/fund', icon: Heart, label: 'Fund', color: 'text-primary' },
    { to: '/membership', icon: Crown, label: 'Member', color: 'text-amber-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="px-5 py-4"
    >
      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Link 
          to="/projects"
          className={cn(
            "glass-subtle rounded-xl p-4 flex flex-col items-center gap-2",
            "hover:bg-accent/20 transition-colors group"
          )}
        >
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
            <FolderKanban className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground">Browse Projects</span>
          <span className="text-xs text-muted-foreground">Find collaborators</span>
        </Link>
        
        <Link 
          to="/projects"
          className={cn(
            "glass-subtle rounded-xl p-4 flex flex-col items-center gap-2",
            "border border-primary/20 hover:border-primary/40 transition-colors group"
          )}
        >
          <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center group-hover:bg-accent/50 transition-colors">
            <Rocket className="w-5 h-5 text-accent-foreground" />
          </div>
          <span className="text-sm font-medium text-foreground">Post Project</span>
          <span className="text-xs text-muted-foreground">Need help?</span>
        </Link>
      </div>

      {/* Bottom Links */}
      <div className="grid grid-cols-4 gap-2">
        {links.map((link, index) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "glass-subtle rounded-xl py-3 px-2 flex flex-col items-center justify-center",
                "hover:bg-accent/20 transition-colors"
              )}
            >
              <Icon className={cn("w-5 h-5 mb-1", link.color)} />
              <span className="text-[10px] text-muted-foreground">{link.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Book Link */}
      <Link 
        to="/book" 
        className={cn(
          "mt-3 glass-subtle rounded-xl p-3 flex items-center justify-center gap-2",
          "hover:bg-accent/20 transition-colors"
        )}
      >
        <BookOpen className="w-5 h-5 text-foreground" />
        <span className="text-sm text-muted-foreground">The Book of LCOVE</span>
      </Link>
    </motion.div>
  );
}
