import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const HomeSupportBar = () => {
  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/30"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}
    >
      <div className="px-4 py-3">
        <Link to="/membership" className="block">
          <Button 
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-medium gap-2 shadow-lg"
          >
            <Heart className="w-5 h-5" />
            Support the Community
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default HomeSupportBar;
