import { QRCodeSVG } from "qrcode.react";
import novi from "@/assets/novi-cutout.webp";
import { EtherIdHalftone } from "@/components/profile/EtherIdHalftone";
import {
  cardPhoto,
  etherIdQr,
  memberCode,
  memberNumber,
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

function hexPoints(cx: number, cy: number, radius: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI / 3);
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

function HeaderMarks() {
  return (
    <svg className="ether-id-head-hex" viewBox="0 0 58 28" aria-hidden="true">
      <polygon points={hexPoints(14, 14, 11)} />
      <polygon points={hexPoints(40, 14, 11)} />
    </svg>
  );
}

function HexRing() {
  const radius = 8;
  const distance = 15;
  const polygons = Array.from({ length: 6 }, (_, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI / 3);
    return (
      <polygon
        key={index}
        points={hexPoints(32 + distance * Math.cos(angle), 30 + distance * Math.sin(angle), radius)}
      />
    );
  });
  return (
    <svg className="ether-id-cluster" viewBox="0 0 64 60" aria-hidden="true">
      {polygons}
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

function Spec({ children }: { children: string }) {
  return <p>{children}</p>;
}

export function EtherIdFace({
  card,
  verifyHref,
}: {
  card: EtherIdCard | EtherIdPublic;
  verifyHref?: string;
}) {
  const full = "token" in card ? card : null;
  const banned = card.status === "Banned";
  const photo = cardPhoto(card);
  const qr = verifyHref ? etherIdQr(verifyHref) : null;
  const joined = (card.member_since || "").replace(/-/g, ".");
  const code = memberCode(card.username, card.member_since);
  const number = memberNumber(card.username, card.member_since);
  const groups = number.split(" ");
  const handle = usernameAt(card.username);
  const passion = (full?.passion || "").trim();
  const role = passion ? passion.toUpperCase() : "MEMBER";
  const reviews = full
    ? full.peer_review_count > 0 && full.peer_review_average != null
      ? `${full.peer_review_average}/${full.peer_review_count}`
      : "—"
    : null;
  const born = full?.birthday_month && full?.birthday_day
    ? `${String(full.birthday_month).padStart(2, "0")}.${String(full.birthday_day).padStart(2, "0")}`
    : null;
  const city = full ? (full.city?.trim() || "—") : null;

  return (
    <div className="ether-id-turn">
      <article className={`ether-id${banned ? " is-banned" : ""}`} data-ether-status={card.status}>
        <header className="ether-id-head">
          <svg className="ether-id-glyph" viewBox="0 0 54 64" aria-hidden="true">
            <path d="M4 4 H50 V16 H22 V26 H44 V38 H22 V48 H50 V60 H4 Z" />
          </svg>
          <p className="ether-id-word">Ether</p>
          <svg className="ether-id-trace" viewBox="0 0 220 40" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 28 H78 C104 28 108 10 134 10 H220" />
          </svg>
          <div className="ether-id-marks">
            <HeaderMarks />
            <span className="ether-id-novi-wrap">
              <span className="ether-id-novi-glow ether-id-pulse" aria-hidden="true" />
              <img src={novi} alt="" data-novi="" className="ether-id-novi" />
            </span>
          </div>
        </header>

        <div className="ether-id-frame">
          <span className="ether-id-frame-glow ether-id-pulse" aria-hidden="true" />
          <div className="ether-id-photo">
            <EtherIdHalftone src={photo} name={card.display_name || "E"} />
            {banned ? <p className="ether-id-stamp">Banned</p> : null}
          </div>
          <div className="ether-id-body">
            <h2 className="ether-id-name">{personnelName(card.display_name)}</h2>
            <p className="ether-id-role">{role}</p>
            <p className="ether-id-code">{code}</p>
            <div className="ether-id-bars">
              <div className="ether-id-bar">
                <span>Joined: {joined || "—"}</span>
                <span>Mb: {groups[0]}{groups[1]}</span>
              </div>
              <div className="ether-id-bar">
                <span className={`ether-id-status ether-id-status-${card.status.toLowerCase()}`}>
                  <i className="ether-id-status-glow ether-id-pulse" aria-hidden="true" />
                  Status: {card.status}
                </span>
                <span>St: {groups[2]}{groups[3]}</span>
              </div>
            </div>
            <div className="ether-id-mid">
              <HexRing />
              <div className="ether-id-serial">
                <p className="ether-id-number">{number}</p>
                <p className="ether-id-handle">{handle || "No username yet"}</p>
              </div>
            </div>
            <div className="ether-id-specs">
              <div className="ether-id-spec-col">
                {full ? (
                  <>
                    <Spec>{`>PASSION ${passion.toUpperCase() || "—"}`}</Spec>
                    <Spec>{`>REVIEWS ${reviews}`}</Spec>
                    <Spec>{`>PROJECTS ${full.projects_completed}`}</Spec>
                    <Spec>{`>BORN ${born ? `${born} SELF-REPORTED` : "—"}`}</Spec>
                  </>
                ) : (
                  <>
                    <Spec>{`>JOINED ${joined || "—"}`}</Spec>
                    <Spec>{`>STATUS ${card.status.toUpperCase()}`}</Spec>
                  </>
                )}
              </div>
              <div className="ether-id-spec-side">
                <p className="ether-id-tag">{code.slice(4)}</p>
                {city != null ? <Spec>{`>CITY ${city.toUpperCase()}`}</Spec> : <Spec>{`>STATUS ${card.status.toUpperCase()}`}</Spec>}
                {full ? <Spec>{`>STATUS ${card.status.toUpperCase()}`}</Spec> : null}
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
              </div>
            </div>
          </div>
        </div>

        <footer className="ether-id-foot">
          <span className="ether-id-brand">Ether</span>
          <svg className="ether-id-bow" viewBox="0 0 90 28" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 14 H16 C40 14 46 4 78 8" />
            <path d="M0 14 H16 C40 14 46 24 78 20" />
          </svg>
          <div className="ether-id-foot-center">
            <p>Ether Personnel</p>
            <Ruler />
          </div>
          <svg className="ether-id-bow is-mirror" viewBox="0 0 90 28" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 14 H16 C40 14 46 4 78 8" />
            <path d="M0 14 H16 C40 14 46 24 78 20" />
          </svg>
          <span className="ether-id-brand ether-id-brand-sub">by LCOVE</span>
        </footer>
      </article>
    </div>
  );
}
