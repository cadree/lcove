/** Wallet status is the live word in capitals, so a ban reads BANNED. */
export function walletStatus(status) {
  return String(status || "Inactive").toUpperCase();
}

/** Card face: cream type on warm near-black, soft pink as the only label color. */
const CREAM = "rgb(236, 231, 220)";
const WARM_BLACK = "rgb(16, 14, 12)";
const SOFT_PINK = "rgb(255, 179, 209)";

const BLANK = new Set(["", "—", "-", "–"]);

function shown(value) {
  if (value == null) return null;
  const text = String(value).trim().replace(/\s+/g, " ");
  if (BLANK.has(text)) return null;
  return text;
}

/** Empty Member Of prints as LCOVE, the same rule as the card. */
export function memberOfPass(value) {
  return shown(value) || "LCOVE";
}

function reviewPass(card) {
  const count = card.peer_review_count;
  if (typeof count === "number" && count <= 0) return null;
  const label = shown(card.peer_review_label);
  if (label && !/^no peer reviews$/i.test(label)) return label;
  if (
    typeof count === "number" &&
    count > 0 &&
    card.peer_review_average != null &&
    !Number.isNaN(Number(card.peer_review_average))
  ) {
    return `${card.peer_review_average} · ${count}`;
  }
  return null;
}

function projectPass(card) {
  const count = card.projects_completed;
  if (typeof count === "number") {
    if (count <= 0) return null;
    const label = shown(card.projects_label);
    if (label && !/^0(\s|$)/.test(label)) return label;
    return String(count);
  }
  const label = shown(card.projects_label);
  if (!label || /^0(\s|$)/.test(label)) return null;
  return label;
}

function row(fields) {
  return fields.filter(Boolean).slice(0, 4);
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Card face prints a short month, uppercased, such as OCT 2026. */
export function sincePass(card) {
  const iso = /^(\d{4})-(\d{2})/.exec(shown(card.member_since) || "");
  if (iso) {
    const month = SHORT_MONTHS[Number(iso[2]) - 1];
    if (month) return `${month} ${iso[1]}`.toUpperCase();
  }
  const label = shown(card.member_since_label);
  if (!label) return null;
  const fromLabel = /^([A-Za-z]+)\s+(\d{4})$/.exec(label);
  if (!fromLabel) return label.toUpperCase();
  const index = SHORT_MONTHS.findIndex((month) => month.toLowerCase() === fromLabel[1].slice(0, 3).toLowerCase());
  const month = index >= 0 ? SHORT_MONTHS[index] : fromLabel[1].slice(0, 3);
  return `${month} ${fromLabel[2]}`.toUpperCase();
}

function nameLines(displayName) {
  const clean = shown(displayName);
  if (!clean) return ["NAME NOT SET"];
  let last = clean;
  let first = null;
  if (clean.includes(",")) {
    const [head, ...rest] = clean.split(",");
    last = head.trim() || clean;
    first = rest.join(",").trim() || null;
  } else {
    const parts = clean.split(" ");
    if (parts.length > 1) {
      last = parts[parts.length - 1];
      first = parts.slice(0, -1).join(" ");
    }
  }
  const lastUp = last.toUpperCase();
  if (!first) return [lastUp];
  return [`${lastUp},`, first.toUpperCase()];
}

function initials(displayName) {
  const parts = (shown(displayName) || "").split(" ").filter(Boolean);
  if (!parts.length) return "E";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

/** Words painted into the strip. Empty passion and city are left out. */
export function etherIdStripCopy(card) {
  const passion = shown(card.passion);
  const city = shown(card.city);
  const kicker = [passion ? passion.split(" ")[0] : "", city || ""].filter(Boolean);
  return {
    nameLines: nameLines(card.display_name),
    kicker: kicker.length ? `— ${kicker.join(" · ")}`.toUpperCase() : null,
    chip: passion ? passion.toUpperCase() : null,
    initials: initials(card.display_name),
  };
}

export function etherIdPassJson(card, meta) {
  const since = sincePass(card);
  const city = shown(card.city);
  const reviews = reviewPass(card);
  const projects = projectPass(card);

  const backFields = [];
  if (shown(card.birthday_label)) {
    backFields.push({
      key: "birthday",
      label: "Birthday",
      value: `${shown(card.birthday_label)} · self-reported`,
    });
  }
  if (since) backFields.push({ key: "since", label: "Member since", value: since });
  if (reviews) backFields.push({ key: "reviews", label: "Reviews", value: reviews });
  if (projects) backFields.push({ key: "projects", label: "Projects", value: projects });
  backFields.push({ key: "verify", label: "Verify", value: meta.verifyUrl });

  const barcode = {
    format: "PKBarcodeFormatQR",
    message: meta.verifyUrl,
    messageEncoding: "iso-8859-1",
    altText: "Scan to verify",
  };

  return {
    formatVersion: 1,
    passTypeIdentifier: meta.passTypeIdentifier,
    serialNumber: meta.serialNumber,
    teamIdentifier: meta.teamIdentifier,
    organizationName: "Ether",
    description: "Ether ID",
    foregroundColor: CREAM,
    backgroundColor: WARM_BLACK,
    labelColor: SOFT_PINK,
    suppressStripShine: true,
    storeCard: {
      secondaryFields: row([
        { key: "member_of", label: "Member of", value: memberOfPass(card.member_of).toUpperCase() },
        since ? { key: "since", label: "Member since", value: since } : null,
        { key: "status", label: "Status", value: walletStatus(card.status) },
        city ? { key: "city", label: "City", value: city.toUpperCase() } : null,
      ]),
      backFields,
    },
    barcode,
    barcodes: [barcode],
    webServiceURL: meta.webServiceURL,
    authenticationToken: meta.authenticationToken,
    sharingProhibited: true,
  };
}
