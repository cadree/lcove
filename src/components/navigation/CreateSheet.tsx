import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarPlus,
  Clapperboard,
  FolderKanban,
  ImagePlus,
  LayoutDashboard,
  MessageCircle,
  NotebookPen,
  Radio,
  ShoppingBag,
  Square,
  Users,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CreateShareFlow } from "@/components/create/CreateShareFlow";
import StoryUpload from "@/components/stories/StoryUpload";
import { SquircleIcon, type IconFill } from "@/components/world/SquircleIcon";
import { NoviPeek } from "@/components/novi/NoviPeek";
import { useAuth } from "@/contexts/AuthContext";
import type { LucideIcon } from "lucide-react";

interface CreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreateAction {
  id: string;
  label: string;
  icon: LucideIcon;
  fill: IconFill;
  run: () => void;
}

export function CreateSheet({ open, onOpenChange }: CreateSheetProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);

  const go = (path: string) => {
    onOpenChange(false);
    window.setTimeout(() => navigate(path), 160);
  };

  const primary: CreateAction[] = [
    {
      id: "post",
      label: "Post",
      icon: ImagePlus,
      fill: "pink",
      run: () => {
        onOpenChange(false);
        setShareOpen(true);
      },
    },
    {
      id: "story",
      label: "Story",
      icon: Square,
      fill: "rose",
      run: () => {
        onOpenChange(false);
        setStoryOpen(true);
      },
    },
    { id: "live", label: "Go live", icon: Radio, fill: "red", run: () => go("/live?action=create") },
    { id: "project", label: "Project", icon: FolderKanban, fill: "cyan", run: () => go("/projects?action=create") },
  ];

  const more: CreateAction[] = [
    { id: "event", label: "Event", icon: CalendarPlus, fill: "cyan", run: () => go("/calendar?action=create") },
    { id: "store", label: "Store item", icon: ShoppingBag, fill: "gold", run: () => go("/store") },
    { id: "board", label: "Board", icon: LayoutDashboard, fill: "denim", run: () => go("/boards") },
    { id: "blog", label: "Blog", icon: NotebookPen, fill: "bone", run: () => go("/profile?action=create-blog") },
    { id: "cinema", label: "Cinema", icon: Clapperboard, fill: "ink", run: () => go("/cinema") },
    { id: "collective", label: "Collective", icon: Users, fill: "rose", run: () => go("/collectives") },
    { id: "message", label: "Message", icon: MessageCircle, fill: "violet", run: () => go("/messages?action=new") },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          overlayClassName="!bg-transparent"
          overlayStyle={{ backgroundColor: "transparent", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
          className="rounded-t-[28px] border-border bg-card/95 px-4 pb-8 backdrop-blur-xl"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
          aria-labelledby="create-sheet-title"
        >
          <div className="mx-auto mb-4 mt-1 h-1 w-10 rounded-full bg-foreground/20" aria-hidden="true" />
          <div className="mb-5 flex items-center justify-between">
            <SheetTitle id="create-sheet-title" className="ether-title text-[26px] text-left">
              Create
            </SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="tap-target inline-flex items-center justify-center text-muted-foreground"
              aria-label="Close create"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!user && (
            <Button variant="outline" className="mb-4 w-full" onClick={() => go("/auth")}>
              Sign in
            </Button>
          )}

          <div className="grid grid-cols-4 gap-2">
            {primary.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.run}
                className="flex min-h-11 flex-col items-center justify-center gap-2 rounded-[16px] px-1 py-3 active:scale-[0.98]"
              >
                <SquircleIcon icon={item.icon} fill={item.fill} size={40} glyph={22} />
                <span className="mono-label text-center text-[10px] text-foreground">{item.label}</span>
              </button>
            ))}
          </div>

          <p className="mono-label mb-2 mt-6 text-[10px] text-muted-foreground">More</p>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {more.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.run}
                className="flex w-[72px] shrink-0 flex-col items-center gap-2 py-1"
              >
                <SquircleIcon icon={item.icon} fill={item.fill} size={54} glyph={24} />
                <span className="mono-label text-center text-[9px] leading-tight text-foreground">{item.label}</span>
              </button>
            ))}
          </div>
          <div className="quest-card relative mt-5 min-h-[8.5rem]">
            <NoviPeek />
            <p className="mono-label text-[8px] text-[hsl(var(--brand))]">Novi // Note</p>
            <p className="lore pr-28 text-[16px] text-foreground">Your first post writes 10 XP.</p>
          </div>
        </SheetContent>
      </Sheet>

      <CreateShareFlow open={shareOpen} onOpenChange={setShareOpen} />
      <StoryUpload open={storyOpen} onOpenChange={setStoryOpen} />
    </>
  );
}
