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

function usernamePass(value) {
  const text = shown(value);
  if (!text || /^no username\b/i.test(text)) return null;
  const handle = text.replace(/^@+/, "");
  if (!handle) return null;
  return `@${handle}`;
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

export function etherIdPassJson(card, meta) {
  const name = shown(card.display_name) || "Name not set";
  const passion = shown(card.passion);
  const username = usernamePass(card.username);
  const since = shown(card.member_since_label);
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
    logoText: "ETHER",
    foregroundColor: CREAM,
    backgroundColor: WARM_BLACK,
    labelColor: SOFT_PINK,
    generic: {
      primaryFields: [{ key: "name", label: "", value: name }],
      secondaryFields: row([
        { key: "member_of", label: "Member of", value: memberOfPass(card.member_of) },
        passion ? { key: "passion", label: "Passion", value: passion } : null,
        { key: "status", label: "Status", value: walletStatus(card.status) },
        username ? { key: "username", label: "Username", value: username } : null,
      ]),
      auxiliaryFields: row([
        since ? { key: "since", label: "Member since", value: since } : null,
        city ? { key: "city", label: "City", value: city } : null,
        reviews ? { key: "reviews", label: "Reviews", value: reviews } : null,
        projects ? { key: "projects", label: "Projects", value: projects } : null,
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
