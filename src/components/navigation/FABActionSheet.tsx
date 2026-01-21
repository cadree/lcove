import { useNavigate } from "react-router-dom";
import { 
  PenSquare, 
  Video, 
  FolderPlus, 
  MessageSquarePlus, 
  Users, 
  CalendarPlus, 
  Store 
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { motion } from "framer-motion";

interface FABActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ActionItem {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  action: () => void;
  color: string;
}

export function FABActionSheet({ open, onOpenChange }: FABActionSheetProps) {
  const navigate = useNavigate();

  const handleAction = (action: () => void) => {
    onOpenChange(false);
    // Small delay for smooth sheet close animation
    setTimeout(action, 150);
  };

  const actions: ActionItem[] = [
    {
      id: "post",
      icon: PenSquare,
      label: "Create Post",
      description: "Share with the community",
      action: () => navigate("/feed?action=create-post"),
      color: "bg-pink-500/10 text-pink-500",
    },
    {
      id: "live",
      icon: Video,
      label: "Start Live Stream",
      description: "Go live now",
      action: () => navigate("/live?action=create"),
      color: "bg-red-500/10 text-red-500",
    },
    {
      id: "project",
      icon: FolderPlus,
      label: "Create Project",
      description: "Start a new project",
      action: () => navigate("/projects?action=create"),
      color: "bg-blue-500/10 text-blue-500",
    },
    {
      id: "message",
      icon: MessageSquarePlus,
      label: "Send Message",
      description: "Start a conversation",
      action: () => navigate("/messages?action=new"),
      color: "bg-green-500/10 text-green-500",
    },
    {
      id: "directory",
      icon: Users,
      label: "Find Creators",
      description: "Discover talent",
      action: () => navigate("/directory"),
      color: "bg-purple-500/10 text-purple-500",
    },
    {
      id: "event",
      icon: CalendarPlus,
      label: "Create Event",
      description: "Schedule something",
      action: () => navigate("/calendar?action=create"),
      color: "bg-orange-500/10 text-orange-500",
    },
    {
      id: "store",
      icon: Store,
      label: "My Store",
      description: "Manage products",
      action: () => navigate("/store"),
      color: "bg-teal-500/10 text-teal-500",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-3xl px-4 pb-8"
        style={{
          paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Handle indicator */}
        <div className="flex justify-center pt-2 pb-4">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Title */}
        <h2 className="text-lg font-semibold text-center mb-4">Quick Actions</h2>

        {/* Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
          {actions.map((item, index) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleAction(item.action)}
              className="flex items-center gap-3 p-4 rounded-2xl bg-secondary/50 hover:bg-secondary/80 active:scale-95 transition-all text-left touch-manipulation"
            >
              <div className={`w-11 h-11 rounded-xl ${item.color} flex items-center justify-center flex-shrink-0`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{item.label}</p>
                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
