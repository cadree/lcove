import { ArrowLeft, Flag } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { GENERATIVE_AI_RULE } from "@/content/copy";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/seo/PageMeta";

const Guidelines = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title="Guidelines · Ether" description={GENERATIVE_AI_RULE} />
      <div className="container max-w-3xl mx-auto px-4 py-8 safe-area-top safe-area-bottom">
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Flag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold">Community Guidelines</h1>
              <p className="text-sm text-muted-foreground">Last updated: October 18, 2026</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p>
            Ether is for people and work they made. Do not harass, scam, or post illegal content.
            Do not impersonate someone else.
          </p>
          <p className="text-foreground">
            {GENERATIVE_AI_RULE}
          </p>
          <p>
            Use Report on a post, profile, comment, message, or project. Use Block on a profile or in a
            direct message. Blocking hides that person's posts, comments, directory listing, and messages
            from you. They cannot message you or follow you.
          </p>
          <p>
            Admins review reports and can remove content or restrict an account.
          </p>
          <div className="flex gap-4 pt-4 border-t">
            <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Guidelines;
