import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { APP_STORE_URL } from "@/config/launch";
import {
  getTheAppDismissed,
  isIosWebVisitor,
  markGetTheAppDismissed,
  shouldShowGetTheAppPrompt,
} from "@/lib/getTheApp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function GetTheAppPrompt() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    const native = Capacitor.isNativePlatform();
    const iosWeb = isIosWebVisitor({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    });
    setOpen(
      shouldShowGetTheAppPrompt({
        storeUrl: APP_STORE_URL,
        signedIn: Boolean(user),
        native,
        iosWeb,
        dismissed: getTheAppDismissed(window.localStorage),
        pathname: location.pathname,
      }),
    );
  }, [user, loading, location.pathname]);

  const dismiss = () => {
    markGetTheAppDismissed(window.localStorage);
    setOpen(false);
  };

  if (!APP_STORE_URL) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Get the app</DialogTitle>
          <DialogDescription>Download the app or continue on the web.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col">
          <Button asChild className="w-full">
            <a href={APP_STORE_URL} onClick={dismiss}>
              Download the app
            </a>
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={dismiss}>
            Continue on web
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
