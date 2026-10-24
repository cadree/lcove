import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { publicJoinPath } from "@/lib/publicJoin";

export function SignUpPrompt() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="file-panel max-w-md p-8 text-center">
        <h1 className="ether-title text-3xl text-foreground">Members only</h1>
        <p className="mt-3 text-muted-foreground">
          Profiles, posts, projects, and the rest of the community are for members.
          Events, products, and live rooms stay open.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button asChild>
            <Link to={publicJoinPath()}>Join</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
