import { Link } from "react-router-dom";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/30 py-12">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h4 className="font-display font-medium mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/feed" className="hover:text-foreground transition-colors">Feed</Link></li>
              <li><Link to="/directory" className="hover:text-foreground transition-colors">Directory</Link></li>
              <li><Link to="/projects" className="hover:text-foreground transition-colors">Projects</Link></li>
              <li><Link to="/calendar" className="hover:text-foreground transition-colors">Events</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-display font-medium mb-4">Community</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/community" className="hover:text-foreground transition-colors">Updates</Link></li>
              <li><Link to="/partners" className="hover:text-foreground transition-colors">Partners</Link></li>
              <li><Link to="/live" className="hover:text-foreground transition-colors">Live</Link></li>
              <li><Link to="/cinema" className="hover:text-foreground transition-colors">Cinema</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-display font-medium mb-4">Creators</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/store" className="hover:text-foreground transition-colors">Store</Link></li>
              <li><Link to="/pipeline" className="hover:text-foreground transition-colors">Pipeline</Link></li>
              <li><Link to="/wallet" className="hover:text-foreground transition-colors">Wallet</Link></li>
              <li><Link to="/membership" className="hover:text-foreground transition-colors">Membership</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-display font-medium mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/book" className="hover:text-foreground transition-colors">Book of Ether</Link></li>
              <li><Link to="/settings" className="hover:text-foreground transition-colors">Settings</Link></li>
              <li><Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-border/30">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-display font-bold text-sm">E</span>
            </div>
            <span className="font-display text-lg font-medium">Ether Creative Collective</span>
          </div>
          
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Ether. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
