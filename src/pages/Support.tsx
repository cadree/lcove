import { ArrowLeft, LifeBuoy } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Support = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto px-4 py-8 safe-area-top safe-area-bottom">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <LifeBuoy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold">Support</h1>
              <p className="text-sm text-muted-foreground">Ether by LCOVE</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p>
            Email <a className="text-primary hover:underline" href="mailto:privacy@ethercreative.co">privacy@ethercreative.co</a> for
            account help, privacy requests, and App Store questions.
          </p>
          <p>
            To delete an account, sign in, open Settings, and choose Delete my account. Deletion is refused
            while a payout, earned credit balance, or Stripe subscription is still open.
          </p>
          <p>
            To report a post, profile, comment, message, or project, use Report on that item. To block someone,
            use Block on their profile or in the conversation. Blocked accounts are listed in Settings.
          </p>
          <div className="flex flex-wrap gap-4 pt-4 border-t">
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
            <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
            <Link to="/guidelines" className="text-primary hover:underline">Community Guidelines</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;
