import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import etherBearLogo from "@/assets/ether-bear-logo.png";

const publicLinks = [
  { label: "Community", to: "/community" },
  { label: "Fund", to: "/fund" },
  { label: "Nuance", to: "/nuance" },
];

export function LandingNav() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="container px-4 sm:px-6 lg:px-8">
        <nav className="py-3 flex items-center justify-between gap-4">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 min-h-11">
            <img src={etherBearLogo} alt="Ether" className="w-8 h-8 object-contain" />
            <span className="ether-title text-2xl hidden sm:inline">Ether</span>
          </button>

          <div className="hidden md:flex items-center gap-1">
            {publicLinks.map((link) => (
              <button
                key={link.to}
                type="button"
                onClick={() => navigate(link.to)}
                className="min-h-11 px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <Button size="sm" className="min-h-11" onClick={() => navigate("/feed")}>
                Feed
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="min-h-11" onClick={() => navigate("/auth")}>
                  Sign in
                </Button>
                <Button size="sm" className="min-h-11" onClick={() => navigate("/auth")}>
                  Join
                </Button>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
