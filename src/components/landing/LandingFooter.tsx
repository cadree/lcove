import { Link } from "react-router-dom";

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

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-8 border-t border-border">
          <span className="ether-title text-xl">Ether</span>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Ether</p>
        </div>
      </div>
    </footer>
  );
}
