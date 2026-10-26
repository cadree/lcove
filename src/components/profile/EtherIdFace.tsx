import { useEffect, useRef, useState, type RefObject } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ETHER_ID_SITE,
  cardHandleLine,
  cardInitials,
  cardKicker,
  cardNameLines,
  memberOfFace,
  memberSinceShort,
  reviewsFace,
  usernameAt,
  type EtherIdCard,
  type EtherIdPublic,
} from "@/lib/etherId";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthName(month: number) {
  return MONTHS[month - 1] ?? "";
}

export function statusClass(status: string) {
  if (status === "Banned") return "border-destructive text-destructive";
  if (status === "Suspended") return "border-foreground text-foreground";
  if (status === "Inactive") return "border-border text-muted-foreground";
  return "border-primary text-primary";
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ));
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useQrSize(boxRef: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState(96);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const next = Math.round(el.clientWidth - 10);
      if (next > 40) setSize(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [boxRef]);
  return size;
}

function PublicEtherId({ card }: { card: EtherIdPublic }) {
  const handle = usernameAt(card.username);
  return (
    <article className="holo-card overflow-hidden px-4 py-5" data-ether-status={card.status}>
      <p className="kicker">Ether ID</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="media-frame h-16 w-16 shrink-0 overflow-hidden bg-muted">
          {card.avatar_url ? (
            <img src={card.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-2xl">
              {(card.display_name || "?").slice(0, 1)}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="ether-title truncate text-[28px]">{card.display_name || "Name not set"}</h2>
          <p className="mt-1 text-sm text-foreground">{handle || "No username yet"}</p>
        </div>
      </div>
      <p className={`mt-4 inline-flex min-h-11 items-center border px-3 text-sm font-semibold ${statusClass(card.status)}`}>
        {card.status}
      </p>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
          <dt className="text-muted-foreground">Member since</dt>
          <dd className="text-right text-foreground">{card.member_since_label || "—"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="text-right text-foreground">Live</dd>
        </div>
      </dl>
    </article>
  );
}

function OwnerEtherId({
  card,
  verifyHref,
  role,
}: {
  card: EtherIdCard;
  verifyHref?: string;
  role?: string | null;
}) {
  const reduced = useReducedMotion();
  const qrBoxRef = useRef<HTMLDivElement>(null);
  const qrSize = useQrSize(qrBoxRef);
  const [last, first] = cardNameLines(card.display_name);
  const kicker = cardKicker(card.passion, card.city);
  const passion = (card.passion || "").trim();
  const since = memberSinceShort(card.member_since, card.member_since_label);
  const initials = cardInitials(card.display_name);

  return (
    <div className={`ether-id-scene${reduced ? " is-flat" : ""}`}>
      <div className="ether-id-spin">
        {reduced ? null : (
          <>
            <div className="ether-id-back" aria-hidden="true" />
            <div className="ether-id-side ether-id-side-left" aria-hidden="true" />
            <div className="ether-id-side ether-id-side-right" aria-hidden="true" />
            <div className="ether-id-side ether-id-side-top" aria-hidden="true" />
            <div className="ether-id-side ether-id-side-bottom" aria-hidden="true" />
          </>
        )}
        <article
          className="ether-id-face"
          data-testid="ether-id-card"
          data-ether-status={card.status}
          aria-label="Ether ID"
        >
          <div className="ether-id-glow" aria-hidden="true" />
          <header className="ether-id-top">
            <div className="ether-id-brand">ETH<b>E</b>R</div>
            <div className="ether-id-lab ether-id-dim">familcy access // member id</div>
          </header>
          <div className="ether-id-photo">
            {card.avatar_url ? (
              <img src={card.avatar_url} alt="" />
            ) : (
              <span className="ether-id-monogram">{initials}</span>
            )}
            <span className="ether-id-tick ether-id-tick-tl" aria-hidden="true" />
            <span className="ether-id-tick ether-id-tick-br" aria-hidden="true" />
          </div>
          <div className="ether-id-info">
            {kicker ? <p className="ether-id-kicker ether-id-lab ether-id-red">{kicker}</p> : null}
            <h2 className="ether-id-name">
              <span>{first ? `${last},` : last}</span>
              {first ? <span>{first}</span> : null}
            </h2>
            <p className="ether-id-handle">{cardHandleLine(role, card.username)}</p>
            {passion ? <p className="ether-id-pass">{passion}</p> : null}
            {verifyHref ? (
              <div className="ether-id-qrbox">
                <div ref={qrBoxRef} className="ether-id-qr" data-testid="ether-id-qr">
                  <QRCodeSVG
                    value={verifyHref}
                    size={qrSize}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#121212"
                    title="Ether ID verify code"
                  />
                </div>
                <p className="ether-id-qr-caption ether-id-lab ether-id-dim">scan to verify</p>
              </div>
            ) : null}
            <dl className="ether-id-grid">
              <div>
                <dt className="ether-id-lab ether-id-dim">Member of</dt>
                <dd className="ether-id-val">{memberOfFace(card.member_of)}</dd>
              </div>
              <div>
                <dt className="ether-id-lab ether-id-dim">Member since</dt>
                <dd className="ether-id-val">{since}</dd>
              </div>
              <div>
                <dt className="ether-id-lab ether-id-dim">Status</dt>
                <dd>
                  <span className={`ether-id-pill is-${card.status.toLowerCase()}`}>
                    <i />
                    {card.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="ether-id-lab ether-id-dim">City</dt>
                <dd className="ether-id-val ether-id-city">{card.city?.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="ether-id-lab ether-id-dim">Reviews</dt>
                <dd className="ether-id-val">{reviewsFace(card.peer_review_average, card.peer_review_count)}</dd>
              </div>
              <div>
                <dt className="ether-id-lab ether-id-dim">Projects</dt>
                <dd className="ether-id-val">{card.projects_completed}</dd>
              </div>
            </dl>
          </div>
          <footer className="ether-id-foot ether-id-lab ether-id-dim">
            <span>{ETHER_ID_SITE}</span>
            <span className="ether-id-foot-line" />
            <span>scan the code to verify</span>
          </footer>
          {reduced ? null : <div className="ether-id-sheen" aria-hidden="true" />}
        </article>
      </div>
    </div>
  );
}

export function EtherIdFace({
  card,
  verifyHref,
  role,
}: {
  card: EtherIdCard | EtherIdPublic;
  verifyHref?: string;
  role?: string | null;
}) {
  if (!("passion" in card)) {
    return <PublicEtherId card={card} />;
  }
  return <OwnerEtherId card={card} verifyHref={verifyHref} role={role} />;
}
