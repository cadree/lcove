import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, Wrench } from 'lucide-react';
import { ToolsSheet } from '@/components/navigation/ToolsSheet';
import { studioShortcuts } from '@/components/navigation/studioTools';
import { SquircleIcon } from '@/components/world/SquircleIcon';

export function ProfileBookEntry() {
  return (
    <div className="px-4 pt-4">
      <Link
        to="/book"
        className="file-panel flex min-h-[72px] items-center gap-3 px-4 py-3"
      >
        <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded-[5px_11px_11px_5px] bg-gradient-to-b from-[#7D0610] to-[#C4142D] text-white">
          <BookOpen className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="mono-label block text-[8px] text-[hsl(var(--brand))]">File CX-01</span>
          <span className="ether-title block text-[16px]">The Book of LCOVE</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>
    </div>
  );
}

export function ToolsEntry() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const shortcuts = studioShortcuts;
  return (
    <div className="px-4 pt-3">
      <div className="file-panel px-3 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 w-full items-center gap-3 text-left"
        >
          <SquircleIcon icon={Wrench} fill="denim" size={34} glyph={17} />
          <span className="min-w-0 flex-1">
            <span className="mono-label block text-[8px] text-muted-foreground">Work · Money · Stage · Partners</span>
            <span className="font-body text-[15px] font-extrabold">Studio</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </button>
        <div className="mt-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {shortcuts.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => navigate(tool.path)}
              className="inline-flex h-11 shrink-0 items-center rounded-full border border-border px-3 font-body text-sm font-semibold"
            >
              {tool.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mono-label inline-flex h-11 shrink-0 items-center px-2 text-[10px] text-muted-foreground"
          >
            See all
          </button>
        </div>
      </div>
      <ToolsSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}

interface ProfileQuickLinksProps {
  isOwner: boolean;
}

/** Former profile tiles now open from Tools, under the book card. */
export function ProfileQuickLinks({ isOwner }: ProfileQuickLinksProps) {
  if (!isOwner) return null;
  return null;
}
