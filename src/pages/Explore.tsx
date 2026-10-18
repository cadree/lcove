import { Link } from "react-router-dom";
import { Folder, Megaphone, Users } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { MoreMenuButton } from "@/components/navigation/MoreMenu";

const sections = [
  {
    to: "/directory",
    icon: Users,
    eyebrow: "People",
    title: "Directory",
    detail: "Profiles you can open",
  },
  {
    to: "/portfolios",
    icon: Folder,
    eyebrow: "Work",
    title: "Portfolios",
    detail: "Portfolio folders",
  },
  {
    to: "/community",
    icon: Megaphone,
    eyebrow: "Updates",
    title: "Community",
    detail: "Public community updates",
  },
];

const Explore = () => {
  return (
    <PageLayout>
      <div className="px-4 sm:px-6 pt-6 pb-8 max-w-3xl mx-auto">
        <header className="flex items-start justify-between gap-3 pb-4 border-b border-border">
          <div>
            <p className="eyebrow">Discover</p>
            <h1 className="ether-title text-3xl sm:text-4xl">Explore</h1>
          </div>
          <MoreMenuButton />
        </header>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.to} className="ether-rule pt-6 first:border-t-0 first:pt-0">
              <p className="eyebrow">{section.eyebrow}</p>
              <Link to={section.to} className="group mt-2 flex items-center justify-between gap-4 min-h-11">
                <span className="flex items-center gap-3">
                  <section.icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                  <span>
                    <span className="ether-title text-2xl block">{section.title}</span>
                    <span className="text-sm text-muted-foreground">{section.detail}</span>
                  </span>
                </span>
              </Link>
            </section>
          ))}
        </div>
      </div>
    </PageLayout>
  );
};

export default Explore;
