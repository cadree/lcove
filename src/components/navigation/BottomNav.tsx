import { Home, Compass, Search, FolderKanban, Calendar, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Feed", path: "/feed" },
  { icon: Search, label: "Directory", path: "/directory" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: User, label: "Profile", path: "/profile" },
];

const BottomNav = () => {
  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
      className="nav-floating"
    >
      <div className="glass-strong rounded-2xl px-2 py-2 flex items-center gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300",
                isActive
                  ? "text-primary bg-primary/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </motion.nav>
  );
};

export default BottomNav;
