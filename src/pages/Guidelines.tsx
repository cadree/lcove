import { Flag } from "lucide-react";
import { Link } from "react-router-dom";
import { BackButton } from "@/components/navigation/BackButton";
import { PageMeta } from "@/components/seo/PageMeta";
import { AI_CONTENT_RULE_ALLOWED, AI_CONTENT_RULE_FORBIDDEN } from "@/lib/aiContentRule";

const Guidelines = () => {

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="Guidelines · Ether"
        description={`${AI_CONTENT_RULE_ALLOWED} ${AI_CONTENT_RULE_FORBIDDEN}`}
      />
      <div className="container max-w-3xl mx-auto px-4 py-8 safe-area-top safe-area-bottom">
        <div className="flex items-center gap-3 mb-8">
          <BackButton label="Go back" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Flag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold">Community Guidelines</h1>
              <p className="text-sm text-muted-foreground">Last updated: October 24, 2026</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p>
            Ether is for people and work they made. Do not harass, scam, or post illegal content.
            Do not impersonate someone else.
          </p>
          <p>
            Do not post or sell sexually explicit content or nudity, work you do not have the rights to, or content that promotes violent extremism or attacks people based on protected characteristics. Accounts that break these rules may be suspended or banned.
          </p>
          <p className="text-foreground">{AI_CONTENT_RULE_ALLOWED}</p>
          <p className="text-foreground">{AI_CONTENT_RULE_FORBIDDEN}</p>
          <p>
            Use Report on a post, profile, comment, message, project, or live stream. Use Block on a profile or in a
            direct message. Blocking hides that person's posts, comments, stories, streams, and messages from you,
            and hides yours from them. Neither of you can message the other.
          </p>
          <p>
            Admins review open reports within 24 hours and can remove the content or dismiss the report.
            Posts, comments, messages, and live chat are checked for objectionable text before they are saved.
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
