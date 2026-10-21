import { Link } from 'react-router-dom';
import { ExternalLink, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Store, StoreImportResult } from '@/hooks/useStore';

interface StoreBrandPanelProps {
  store: Store & { profile?: { display_name?: string | null; city?: string | null } };
  importResult?: StoreImportResult | null;
  importing?: boolean;
  showContinue?: boolean;
}

function websiteHref(store: Store) {
  const raw = store.website_url || store.shopify_store_url;
  if (!raw) return null;
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

export function StoreBrandPanel({ store, importResult, importing, showContinue }: StoreBrandPanelProps) {
  const href = websiteHref(store);
  const knownLink = importResult?.source === 'link' || store.import_status === 'link';
  const knownShopify = importResult?.source === 'shopify' || store.import_status === 'imported';
  const shopify = knownShopify || (!knownLink && !!store.shopify_store_url && store.import_status !== 'failed');
  const status = importing ? 'importing' : importResult?.status || store.import_status;
  const message = importing
    ? 'Importing the public catalog…'
    : importResult?.message || store.import_error || (store.import_status === 'imported'
      ? `Imported ${store.import_count ?? 0} products.`
      : store.import_status === 'link'
        ? 'A link card was added from the page preview.'
        : null);
  const failed = status === 'failed';

  return (
    <section className="file-panel mb-6 overflow-hidden">
      {store.cover_image_url && (
        <img src={store.cover_image_url} alt="" className="h-36 w-full object-cover" />
      )}
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
        {store.logo_url ? (
          <img src={store.logo_url} alt="" className="mark-cutout h-16 w-16 shrink-0 object-contain" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[linear-gradient(160deg,hsl(var(--scan)),hsl(var(--brand)))]">
            <span className="font-display text-2xl text-white">{store.name.charAt(0)}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="ether-title text-2xl text-foreground">{store.name}</h2>
          {store.profile?.display_name && (
            <p className="text-sm text-muted-foreground">
              {store.profile.display_name}
              {store.profile.city ? ` · ${store.profile.city}` : ''}
            </p>
          )}
          {store.description && (
            <p className="mt-2 text-sm text-muted-foreground">{store.description}</p>
          )}
          {href && (
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <a href={href} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                {shopify ? 'Shop on Shopify' : 'Visit store'}
              </a>
            </Button>
          )}
        </div>
      </div>
      {(status || showContinue) && (
        <div className={`flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${failed ? 'bg-destructive/10' : ''}`}>
          {message && (
            <p className={`flex items-start gap-2 text-sm ${failed ? 'text-destructive' : 'text-muted-foreground'}`}>
              {importing ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              ) : failed ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{message}</span>
            </p>
          )}
          {showContinue && (
            <Button asChild className="shrink-0">
              <Link to="/feed">Continue to the feed</Link>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
