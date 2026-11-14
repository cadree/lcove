import { Button } from "@/components/ui/button";
import { CalendarDays, FolderKanban, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FEATURE_PREVIEW, FEATURE_PREVIEW_LABEL } from "@/content/copy";
import { publicJoinPath } from "@/lib/publicJoin";

const icons = [Users, CalendarDays, FolderKanban] as const;

export function FeaturePreview({ joinSearch = "" }: { joinSearch?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const destination = user ? "/feed" : publicJoinPath(joinSearch);

  return (
    <section className="py-16 md:py-24">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <p className="eyebrow mb-2">{FEATURE_PREVIEW_LABEL}</p>
          <h2 className="ether-title text-3xl sm:text-4xl">{FEATURE_PREVIEW_LABEL}</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {FEATURE_PREVIEW.map((feature, index) => {
            const Icon = icons[index];
            return (
              <article key={feature.title} className="border-t border-border pt-6">
                <Icon className="w-5 h-5 mb-4" strokeWidth={1.5} />
                <h3 className="ether-title text-2xl mb-4">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.line}</p>
              </article>
            );
          })}
        </div>

        <div className="mx-auto mt-10 max-w-md">
          <Button className="w-full" onClick={() => navigate(destination)}>
            {user ? "Home" : "Join"}
          </Button>
        </div>
      </div>
    </section>
  );
}
