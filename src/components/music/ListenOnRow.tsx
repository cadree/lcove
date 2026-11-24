import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MusicPlatform } from "@/lib/musicLinks";
import { openMusicLink, type ListenOn } from "@/lib/musicCatalog";

const PLATFORM_ICONS: Partial<Record<MusicPlatform, React.ReactNode>> = {
  spotify: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  ),
  apple_music: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.8.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81.84-.553 1.472-1.287 1.88-2.208.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.8-.228-2.403-.95-.593-.71-.674-1.86.24-2.757.563-.553 1.27-.78 2.024-.86.37-.04.747-.036 1.12-.07.19-.017.378-.064.55-.155.23-.122.335-.32.34-.57l.003-4.963c0-.31-.168-.48-.478-.43-.365.06-.73.13-1.092.2-1.13.214-2.26.43-3.39.644l-1.763.334c-.328.063-.463.22-.468.555-.002.075 0 .15 0 .224l-.004 6.553c-.002.455-.057.904-.252 1.324-.3.65-.805 1.048-1.492 1.22-.344.085-.695.134-1.05.14-.905.012-1.725-.2-2.34-.916-.642-.747-.645-1.994.305-2.844.535-.48 1.183-.727 1.883-.812.43-.052.864-.034 1.295-.08.2-.022.396-.07.582-.145.215-.085.328-.26.338-.492.006-.14.002-.28.002-.42l.004-8.504c0-.182.027-.36.09-.532.11-.3.33-.46.622-.522.207-.044.418-.074.628-.106l1.203-.215c.79-.147 1.58-.293 2.37-.438l2.41-.45 1.322-.246c.17-.032.343-.052.516-.056.253-.007.413.168.413.418v.05z" />
    </svg>
  ),
};

export const MusicServiceIcon = ({ platform }: { platform?: MusicPlatform }) =>
  <>{(platform && PLATFORM_ICONS[platform]) || <ExternalLink className="w-3.5 h-3.5" />}</>;

/** One pill per service. The list is already de-duplicated by listenOnServices. */
export const ListenOnRow = ({ services, className }: { services: ListenOn[]; className?: string }) => {
  if (services.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} data-testid="listen-on">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Listen on</span>
      {services.map((service) => (
        <button
          key={service.platform}
          type="button"
          onClick={() => openMusicLink(service.url)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-3.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/30"
        >
          <MusicServiceIcon platform={service.platform} />
          {service.label}
        </button>
      ))}
    </div>
  );
};
