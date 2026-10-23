import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { publicJoinPath } from "@/lib/publicJoin";

const publicLinks = [
  { label: "Community", to: "/community" },
  { label: "Fund", to: "/fund" },
  { label: "Nuance", to: "/nuance" },
];

export function LandingNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 border-b border-border/60 bg-[var(--bar)] backdrop-blur-[18px]"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="px-4 sm:px-6">
        <nav className="flex min-h-[54px] items-center justify-between gap-3">
          <button type="button" onClick={() => navigate("/")} className="kicker min-h-11 text-left">
            Familcy // Lcove
          </button>

          <div className="hidden items-center gap-1 md:flex">
            {publicLinks.map((link) => (
              <button
                key={link.to}
                type="button"
                onClick={() => navigate(link.to)}
                className="mono-label min-h-11 px-3 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {user ? (
              <button type="button" className="mono-label min-h-11 px-2 text-[12px]" onClick={() => navigate("/feed")}>
                Home
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="mono-label min-h-11 px-2 text-[12px]"
                  onClick={() => navigate(publicJoinPath(location.search))}
                >
                  Join
                </button>
                <button type="button" className="mono-label min-h-11 px-2 text-[12px]" onClick={() => navigate("/auth")}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
