import { Home, Compass, Search, FolderKanban, Calendar, User, MessageCircle, Bell } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useNotifications } from "@/hooks/useNotifications";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Feed", path: "/feed" },
  { icon: Search, label: "Directory", path: "/directory" },
  { icon: MessageCircle, label: "Messages", path: "/messages" },
  { icon: Bell, label: "Notifications", path: "/notifications" },
  { icon: User, label: "Profile", path: "/profile" },
];

const BottomNav = () => {
  const { unreadCount } = useNotifications();
  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
      className="nav-floating"
    >
      <div className="relative bg-card/70 backdrop-blur-xl rounded-full px-3 py-2.5 flex items-center gap-2 border border-border/40 shadow-2xl shadow-black/40">
        {navItems.map((item) => {
          const isNotifications = item.path === '/notifications';
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-full bg-accent/60 border border-border/50"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <item.icon 
                    className={cn(
                      "w-5 h-5 relative z-10 transition-transform duration-200",
                      isActive && "scale-105"
                    )} 
                    strokeWidth={isActive ? 2 : 1.5} 
                  />
                  {isNotifications && unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-[16px] flex items-center justify-center px-1 text-[9px] font-bold bg-primary text-primary-foreground rounded-full z-20">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </motion.nav>
  );
};

export default BottomNav;
