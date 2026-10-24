import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import "@fontsource/space-grotesk/latin-700.css";
import novi from "@/assets/novi-cutout.webp";
import { EtherWordmark } from "@/components/brand/EtherWordmark";
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

const BARS = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2];

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

type OrientationWithPermission = {
  requestPermission?: () => Promise<string>;
};

function usePlateTilt(
  slotRef: React.RefObject<HTMLDivElement | null>,
  tiltRef: React.RefObject<HTMLElement | null>,
  reduced: boolean,
) {
  useEffect(() => {
    const slot = slotRef.current;
    const tilt = tiltRef.current;
    if (!slot || !tilt || reduced) return;

    let frame = 0;
    let hovering = false;
    const paint = (rx: number, ry: number, px: number, py: number) => {
      const clamp = (value: number) => Math.max(-12, Math.min(12, value));
      tilt.style.setProperty("--rx", `${clamp(rx).toFixed(2)}deg`);
      tilt.style.setProperty("--ry", `${clamp(ry).toFixed(2)}deg`);
      tilt.style.setProperty("--px", px.toFixed(2));
      tilt.style.setProperty("--py", py.toFixed(2));
    };
    const queue = (apply: () => void) => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };
    const rest = () => {
      slot.classList.add("is-resting");
      paint(0, 0, 0, 0);
    };
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = tilt.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      hovering = true;
      slot.classList.remove("is-resting");
      queue(() => paint(-py * 24, px * 24, px * 16, py * 14));
    };
    const onLeave = () => {
      hovering = false;
      rest();
    };
    const onOrient = (event: DeviceOrientationEvent) => {
      if (hovering) return;
      const gamma = event.gamma ?? 0;
      const beta = (event.beta ?? 35) - 35;
      slot.classList.remove("is-resting");
      queue(() => paint(beta * 0.34, gamma * 0.26, gamma * 0.14, beta * 0.12));
    };
    const askGyro = () => {
      const orientation = DeviceOrientationEvent as unknown as OrientationWithPermission;
      if (typeof orientation.requestPermission !== "function") return;
      orientation.requestPermission().then((state) => {
        if (state === "granted") window.addEventListener("deviceorientation", onOrient);
      }).catch(() => {});
    };

    slot.addEventListener("pointermove", onPointer);
    slot.addEventListener("pointerleave", onLeave);
    const orientation = DeviceOrientationEvent as unknown as OrientationWithPermission;
    if (typeof orientation.requestPermission === "function") {
      slot.addEventListener("pointerdown", askGyro);
    } else {
      window.addEventListener("deviceorientation", onOrient);
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      slot.removeEventListener("pointermove", onPointer);
      slot.removeEventListener("pointerleave", onLeave);
      slot.removeEventListener("pointerdown", askGyro);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, [reduced, slotRef, tiltRef]);
}

function Screws() {
  return (
    <div className="ether-id-screws" aria-hidden="true">
      <i /><i /><i /><i /><i /><i />
    </div>
  );
}

function Chip() {
  return (
    <div className="ether-id-chip" aria-hidden="true">
      {BARS.map((width, index) => (
        <span key={index} style={{ width }} />
      ))}
    </div>
  );
}

function Star() {
  return (
    <svg className="ether-id-star" viewBox="0 0 24 24" aria-hidden="true" data-plate="star">
      <path d="M12 1.1 13.55 10.45 22.9 12 13.55 13.55 12 22.9 10.45 13.55 1.1 12 10.45 10.45 Z" />
      <path fill="#ff9fc8" d="M19.2 2.4 19.7 4.5 21.8 5 19.7 5.5 19.2 7.6 18.7 5.5 16.6 5 18.7 4.5 Z" />
    </svg>
  );
}

export function EtherIdFace({
  card,
  verifyHref,
}: {
  card: EtherIdCard | EtherIdPublic;
  verifyHref?: string;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  usePlateTilt(slotRef, tiltRef, reduced);

  const full = "token" in card ? card : null;
  const banned = card.status === "Banned";
  const photo = cardPhoto(card);
  const qr = verifyHref ? etherIdQr(verifyHref) : null;
  const joined = (card.member_since || "").replace(/-/g, ".");
  const code = memberCode(card.username, card.member_since);
  const number = memberNumber(card.username, card.member_since);
  const handle = usernameAt(card.username);
  const passion = (full?.passion || "").trim();
  const reviews = full
    ? full.peer_review_count > 0 && full.peer_review_average != null
      ? `${full.peer_review_average}/${full.peer_review_count}`
      : "—"
    : null;
  const born = full?.birthday_month && full?.birthday_day
    ? `${String(full.birthday_month).padStart(2, "0")}.${String(full.birthday_day).padStart(2, "0")}`
    : null;
  const city = full ? (full.city?.trim() || "—") : null;
  const initial = (card.display_name || "E").trim().charAt(0).toUpperCase() || "E";
  const rail = [
    ["01", "ID", number],
    ["02", "Joined", joined || "—"],
    ["03", "Status", card.status],
  ];
  if (full) rail.push(["04", "Passion", passion || "—"]);

  return (
    <div className={`ether-id-slot${reduced ? " is-reduced" : ""}`} ref={slotRef}>
      <div className="ether-id-fit">
        <div className="ether-id-stage">
          <div className="ether-id-float">
            <article
              ref={tiltRef}
              className={`ether-id ether-id-tilt${banned ? " is-banned" : ""}`}
              data-ether-status={card.status}
            >
              <p className="ether-id-familcy" data-plate="familcy">FAMILCY</p>
              <div className="ether-id-bezel">
                <div className="ether-id-photo">
                  {photo ? (
                    <img src={photo} alt="" className="ether-id-portrait" data-photo="" />
                  ) : (
                    <span className="ether-id-monogram">{initial}</span>
                  )}
                </div>
                {qr ? (
                  <div className="ether-id-qr" data-testid="ether-id-qr" data-plate="qr">
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
                <div className={`ether-id-holo${qr ? "" : " is-solo"}`} data-plate="novi">
                  <span className="ether-id-holo-glow ether-id-pulse" aria-hidden="true" />
                  <img src={novi} alt="" data-novi="" />
                </div>
                <Star />
                {banned ? <p className="ether-id-band">Banned</p> : null}
              </div>
              <div className="ether-id-rail">
                <div className="ether-id-rail-spin">
                  {rail.map(([index, label, value]) => (
                    <p
                      key={index}
                      className={`ether-id-field${label === "Status" ? ` is-${card.status.toLowerCase()}` : ""}`}
                      data-plate="field"
                    >
                      <span>{index} {label}</span>
                      <strong>{value}</strong>
                    </p>
                  ))}
                </div>
              </div>
              <div className="ether-id-sheen" aria-hidden="true" />
              <div className="ether-id-deck">
                <div className="ether-id-deck-sheen" aria-hidden="true" />
                <Screws />
                <div className="ether-id-identity">
                  <Chip />
                  <div className="ether-id-copy">
                    <p className="ether-id-kicker">Name</p>
                    <p className="ether-id-name" data-plate="name">{personnelName(card.display_name)}</p>
                    <p className="ether-id-handle" data-plate="handle">{handle || "No username yet"}</p>
                    <p className="ether-id-code" data-plate="code"><span>Code</span> {code}</p>
                    {full ? (
                      <div className="ether-id-stats">
                        <p data-plate="stat"><span>05 Reviews</span><strong>{reviews}</strong></p>
                        <p data-plate="stat"><span>06 Projects</span><strong>{full.projects_completed}</strong></p>
                        <p data-plate="stat">
                          <span>07 Born</span>
                          <strong>{born || "—"}</strong>
                          {born ? <em>self-reported</em> : null}
                        </p>
                        <p className="is-wide" data-plate="stat"><span>08 City</span><strong>{city}</strong></p>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="ether-id-mark" data-plate="logo">
                  <EtherWordmark className="ether-id-logo" alt="Ether" />
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
