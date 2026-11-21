import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { publicJoinPath } from "@/lib/publicJoin";

export function SignUpPrompt() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="file-panel max-w-md p-8 text-center">
        <h1 className="ether-title text-3xl text-foreground">Your creative world starts here</h1>
        <p className="mt-3 text-muted-foreground">
          Discover a community built for creatives. Join the Familcy to connect,
          collaborate, and create.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button asChild>
            <Link to={publicJoinPath()}>Join ETHER</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
