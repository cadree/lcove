import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";

interface HomeEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoReorder: boolean;
  onToggleAutoReorder: () => void;
  onReset: () => void;
}

export function HomeEditSheet({
  open,
  onOpenChange,
  autoReorder,
  onToggleAutoReorder,
  onReset,
}: HomeEditSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>Customize Home</SheetTitle>
          <SheetDescription>
            Personalize your home screen layout
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Auto-reorder toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-reorder" className="text-base font-medium">
                Smart Reordering
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically organize based on your usage
              </p>
            </div>
            <Switch
              id="auto-reorder"
              checked={autoReorder}
              onCheckedChange={onToggleAutoReorder}
            />
          </div>

          {/* Instructions */}
          <div className="rounded-xl bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">How it works</p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Tap items to pin/unpin from your "Pinned" section</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>"For You" shows your most-used items</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Your layout adapts as you use the app</span>
              </li>
            </ul>
          </div>

          {/* Reset button */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              onReset();
              onOpenChange(false);
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Default
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
