import { Link } from "react-router-dom";
import { EtherWordmark } from "@/components/brand/EtherWordmark";

const columns = [
  {
    title: "Public",
    links: [
      { label: "Community updates", to: "/community" },
      { label: "Fund", to: "/fund" },
      { label: "Nuance", to: "/nuance" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", to: "/auth" },
      { label: "Join", to: "/auth" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      { label: "Guidelines", to: "/guidelines" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="ether-title text-xl mb-4">{column.title}</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="inline-flex items-center min-h-11 hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-border pt-8 md:flex-row md:items-center">
          <EtherWordmark className="h-8" />
          <p className="text-sm text-muted-foreground">© 2026 etherbylcove</p>
        </div>
      </div>
    </footer>
  );
}
