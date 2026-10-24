import { QRCodeSVG } from "qrcode.react";
import { birthdayFace, usernameAt, type EtherIdCard, type EtherIdPublic } from "@/lib/etherId";

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

export function EtherIdFace({
  card,
  verifyHref,
}: {
  card: EtherIdCard | EtherIdPublic;
  verifyHref?: string;
}) {
  const full = "token" in card ? card : null;
  const birthday = full ? birthdayFace(full) : null;
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

      {full && (
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
            <dt className="text-muted-foreground">Passion</dt>
            <dd className="text-right text-foreground">{full.passion || "—"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
            <dt className="text-muted-foreground">Peer reviews</dt>
            <dd className="text-right text-foreground">{full.peer_review_label}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
            <dt className="text-muted-foreground">Projects</dt>
            <dd className="text-right text-foreground">{full.projects_label}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
            <dt className="text-muted-foreground">Member since</dt>
            <dd className="text-right text-foreground">{card.member_since_label || "—"}</dd>
          </div>
          {birthday && (
            <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
              <dt className="text-muted-foreground">Birthday</dt>
              <dd className="text-right text-foreground">
                {birthday.label}
                <span className="mt-0.5 block text-xs text-muted-foreground">{birthday.note}</span>
              </dd>
            </div>
          )}
        </dl>
      )}

      {!full && (
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
      )}

      {verifyHref && (
        <div className="mt-5 flex flex-col items-center">
          <div className="bg-white p-3">
            <QRCodeSVG value={verifyHref} size={168} level="M" bgColor="#ffffff" fgColor="#121212" />
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Scan to read the live status. A saved image is not proof.
          </p>
        </div>
      )}
    </article>
  );
}
