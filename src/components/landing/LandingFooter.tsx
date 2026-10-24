import { Link, useLocation } from "react-router-dom";
import { EtherWordmark } from "@/components/brand/EtherWordmark";
import { APP_STORE_URL, INSTAGRAM_URL, SLACK_URL } from "@/config/launch";
import { APP_STORE_COMING, SLACK_INTRO } from "@/content/copy";
import { publicJoinPath } from "@/lib/publicJoin";

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
      { label: "Join", to: "join" },
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
  const location = useLocation();
  const columnsWithJoin = columns.map((column) => ({
    ...column,
    links: column.links.map((link) =>
      link.to === "join" ? { ...link, to: publicJoinPath(location.search) } : link,
    ),
  }));

  return (
    <footer className="border-t border-border py-12">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          {columnsWithJoin.map((column) => (
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

        <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {INSTAGRAM_URL ? (
            <a href={INSTAGRAM_URL} className="min-h-11 text-muted-foreground hover:text-foreground">
              Instagram
            </a>
          ) : null}
          {SLACK_URL ? (
            <a href={SLACK_URL} className="min-h-11 text-muted-foreground hover:text-foreground">
              Slack
            </a>
          ) : null}
          {SLACK_URL ? (
            <p className="text-muted-foreground">{SLACK_INTRO}</p>
          ) : null}
          {APP_STORE_URL ? (
            <a href={APP_STORE_URL} className="inline-flex min-h-11 items-center rounded-lg bg-foreground px-3 text-background">
              Download on the App Store
            </a>
          ) : (
            <p className="text-muted-foreground">{APP_STORE_COMING}</p>
          )}
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-border pt-8 md:flex-row md:items-center">
          <EtherWordmark className="h-8" />
          <p className="text-sm text-muted-foreground">© 2026 etherbylcove</p>
        </div>
      </div>
    </footer>
  );
}
