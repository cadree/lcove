import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/seo/PageMeta";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <PageLayout>
      <PageMeta title="Page not found · Ether" description="This page isn't on Ether." />
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="eyebrow">Ether</p>
        <h1 className="font-display text-5xl text-foreground">404</h1>
        <p className="max-w-xs text-muted-foreground">This page isn't on Ether.</p>
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </PageLayout>
  );
};

export default NotFound;
