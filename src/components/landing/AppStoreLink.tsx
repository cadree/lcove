import { APP_STORE_URL } from "@/config/launch";
import { cn } from "@/lib/utils";

export function AppStoreLink({ className }: { className?: string }) {
  if (!APP_STORE_URL) return null;
  return (
    <a
      href={APP_STORE_URL}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-lg bg-foreground px-3 text-background",
        className,
      )}
    >
      Download on the App Store
    </a>
  );
}
