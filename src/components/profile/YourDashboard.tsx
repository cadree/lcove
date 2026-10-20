import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useOwnViewDashboard } from '@/hooks/usePostViews';

export function YourDashboard() {
  const [open, setOpen] = useState(false);
  const { data } = useOwnViewDashboard();
  const views = data?.views_30d ?? 0;

  return (
    <div className="pt-3">
      <button
        type="button"
        className="file-panel flex min-h-11 w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          <span className="block font-body text-sm font-semibold text-foreground">Your dashboard</span>
          <span className="mono-label text-[10px] text-muted-foreground">Views · last 30 days</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="font-body text-lg font-extrabold text-foreground">{views}</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="file-panel px-3 py-3">
            <span className="mono-label text-[10px] text-muted-foreground">Photos</span>
            <span className="mt-1 block font-body text-lg font-extrabold text-foreground">{data?.photo_views_30d ?? 0}</span>
          </div>
          <div className="file-panel px-3 py-3">
            <span className="mono-label text-[10px] text-muted-foreground">Videos</span>
            <span className="mt-1 block font-body text-lg font-extrabold text-foreground">{data?.video_views_30d ?? 0}</span>
          </div>
        </div>
      )}
    </div>
  );
}
