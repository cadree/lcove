import { Home, Compass, Search, User, MessageCircle, Bell } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
const navItems = [{
  icon: Home,
  label: "Home",
  path: "/"
}, {
  icon: Compass,
  label: "Feed",
  path: "/feed"
}, {
  icon: Search,
  label: "Directory",
  path: "/directory"
}, {
  icon: MessageCircle,
  label: "Messages",
  path: "/messages"
}, {
  icon: Bell,
  label: "Notifications",
  path: "/notifications"
}, {
  icon: User,
  label: "Profile",
  path: "/profile"
}];
const BottomNav = () => {
  return <motion.nav initial={{
    y: 100,
    opacity: 0
  }} animate={{
    y: 0,
    opacity: 1
  }} transition={{
    delay: 0.3,
    duration: 0.5,
    ease: [0.16, 1, 0.3, 1]
  }} className="nav-floating">
      <div className="relative glass-strong rounded-2xl px-2 py-2 gap-1 shadow-elevated flex-col flex items-center justify-start">
        {/* Subtle top highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent rounded-t-2xl" />
        
        {navItems.map(item => <NavLink key={item.path} to={item.path} className={({
        isActive
      }) => cn("relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ease-smooth", isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent/40")}>
            {({
          isActive
        }) => <>
                {isActive && <motion.div layoutId="nav-indicator" className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20" transition={{
            type: "spring",
            bounce: 0.15,
            duration: 0.5
          }} />}
                <motion.div whileTap={{
            scale: 0.9
          }} transition={{
            duration: 0.15
          }}>
                  <item.icon className={cn("w-5 h-5 relative z-10 transition-all duration-300", isActive && "drop-shadow-[0_0_8px_hsl(340_82%_65%/0.5)]")} strokeWidth={isActive ? 2.5 : 1.5} />
                </motion.div>
              </>}
          </NavLink>)}
      </div>
    </motion.nav>;
};
export default BottomNav;