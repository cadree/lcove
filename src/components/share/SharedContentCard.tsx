import { useNavigate } from 'react-router-dom';
import type { MessageSharePreview } from '@/lib/sharing';

export function SharedContentCard({ share, compact = false }: { share: MessageSharePreview; compact?: boolean }) {
  const navigate = useNavigate();
  const card = (
    <>
      {share.mediaUrl && (
        share.mediaType === 'video' ? (
          <video src={share.mediaUrl} className={compact ? 'h-11 w-11 object-cover' : 'aspect-square w-full object-cover'} muted playsInline />
        ) : (
          <img src={share.mediaUrl} alt="" className={compact ? 'h-11 w-11 object-cover' : 'aspect-square w-full object-cover'} />
        )
      )}
      <span className={compact ? 'block min-w-0 flex-1 px-2 py-1.5' : 'block px-3 py-2'}>
        <span className="block truncate text-sm font-semibold text-foreground">{share.title}</span>
        {share.subtitle && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{share.subtitle}</span>
        )}
      </span>
    </>
  );

  const frame = compact
    ? 'flex w-[220px] items-center overflow-hidden rounded-[2px] border border-border bg-card text-left'
    : 'w-[220px] overflow-hidden rounded-[2px] border border-border bg-card text-left';

  if (!share.href) {
    return <div className={frame}>{card}</div>;
  }

  return (
    <button
      type="button"
      className={frame}
      onClick={() => navigate(share.href)}
    >
      {card}
    </button>
  );
}
