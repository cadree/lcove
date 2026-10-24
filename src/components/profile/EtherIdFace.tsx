import { QRCodeSVG } from "qrcode.react";
import novi from "@/assets/novi-cutout.webp";
import { EtherIdHalftone } from "@/components/profile/EtherIdHalftone";
import {
  birthdayFace,
  cardPhoto,
  etherIdQr,
  personnelName,
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

function Row({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="ether-id-row">
      <dt>{label}</dt>
      <dd>
        {value}
        {note ? <span className="ether-id-note">{note}</span> : null}
      </dd>
    </div>
  );
}

function Hexes() {
  return (
    <svg className="ether-id-hex" viewBox="0 0 86 28" aria-hidden="true">
      <polygon points="14,3 23,8 23,18 14,23 5,18 5,8" />
      <polygon points="36,6 44,10.5 44,19.5 36,24 28,19.5 28,10.5" />
      <polygon points="54,2 61,6 61,14 54,18 47,14 47,6" />
      <polygon points="74,8 81,12 81,20 74,24 67,20 67,12" />
    </svg>
  );
}

function Ruler() {
  return (
    <div className="ether-id-ruler" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index}>
          <i />
          {index}
        </span>
      ))}
    </div>
  );
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
  const banned = card.status === "Banned";
  const photo = cardPhoto(card);
  const qr = verifyHref ? etherIdQr(verifyHref) : null;
  const joined = (card.member_since || "").replace(/-/g, ".");

  return (
    <article className={`ether-id${banned ? " is-banned" : ""}`} data-ether-status={card.status}>
      <div className="ether-id-ring ether-id-pulse" aria-hidden="true" />
      <header className="ether-id-top">
        <p className="ether-id-word">Ether</p>
        <span className="ether-id-novi-wrap">
          <span className="ether-id-novi-glow ether-id-pulse" aria-hidden="true" />
          <img src={novi} alt="" data-novi="" className="ether-id-novi" />
        </span>
      </header>

      <div className="ether-id-main">
        <div className="ether-id-photo">
          <span className="ether-id-frame-glow ether-id-pulse" aria-hidden="true" />
          <div className="ether-id-photo-clip">
            <EtherIdHalftone src={photo} name={card.display_name || "E"} banned={banned} />
            {banned ? <p className="ether-id-stamp">Banned</p> : null}
          </div>
        </div>
        <svg className="ether-id-connector" viewBox="0 0 18 120" preserveAspectRatio="none" aria-hidden="true">
          <path className="ether-id-connector-glow ether-id-pulse" d="M1 26 C 1 70, 17 38, 17 92" />
          <path className="ether-id-connector-line" d="M1 26 C 1 70, 17 38, 17 92" />
        </svg>
        <div className="ether-id-data">
          <span className="ether-id-frame-glow ether-id-pulse" aria-hidden="true" />
          <h2 className="ether-id-name">{personnelName(card.display_name)}</h2>
          <p className="ether-id-handle">{handle || "No username yet"}</p>
          <p className={`ether-id-status ether-id-status-${card.status.toLowerCase()}`}>
            <span className="ether-id-status-glow ether-id-pulse" aria-hidden="true" />
            <span>{card.status}</span>
          </p>
          {joined ? <p className="ether-id-serial">{joined}</p> : null}
          <dl>
            {full ? (
              <>
                <Row label="Passion" value={full.passion || "—"} />
                <Row label="Reviews" value={full.peer_review_label} />
                <Row label="Projects" value={full.projects_label} />
                <Row label="Joined" value={card.member_since_label || "—"} />
                {birthday ? <Row label="Born" value={birthday.label} note={birthday.note} /> : null}
              </>
            ) : (
              <Row label="Joined" value={card.member_since_label || "—"} />
            )}
          </dl>
          <Hexes />
        </div>
      </div>

      <footer className="ether-id-foot">
        <div>
          <div className="ether-id-brands">
            <span>Ether</span>
            <span>Ether</span>
          </div>
          <Ruler />
        </div>
        {qr ? (
          <div className="ether-id-qr" data-testid="ether-id-qr">
            <QRCodeSVG
              value={qr.value}
              size={qr.size}
              level={qr.level}
              marginSize={qr.marginSize}
              bgColor={qr.bgColor}
              fgColor={qr.fgColor}
              title="Ether ID verify code"
            />
          </div>
        ) : null}
      </footer>
    </article>
  );
}
