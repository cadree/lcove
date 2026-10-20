import { useNavigate } from 'react-router-dom';
import type { MessageSharePreview } from '@/lib/sharing';

export function SharedContentCard({ share }: { share: MessageSharePreview }) {
  const navigate = useNavigate();
  const card = (
    <>
      {share.mediaUrl && (
        share.mediaType === 'video' ? (
          <video src={share.mediaUrl} className="aspect-square w-full object-cover" muted playsInline />
        ) : (
          <img src={share.mediaUrl} alt="" className="aspect-square w-full object-cover" />
        )
      )}
      <span className="block px-3 py-2">
        <span className="block truncate text-sm font-semibold text-foreground">{share.title}</span>
        {share.subtitle && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{share.subtitle}</span>
        )}
      </span>
    </>
  );

  if (!share.href) {
    return <div className="w-[220px] overflow-hidden rounded-[2px] border border-border bg-card">{card}</div>;
  }

  return (
    <button
      type="button"
      className="w-[220px] overflow-hidden rounded-[2px] border border-border bg-card text-left"
      onClick={() => navigate(share.href)}
    >
      {card}
    </button>
  );
}
