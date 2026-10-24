import { passColors } from "./ether-id-palette.mjs";

/** Wallet status is the live word in capitals, so a ban reads BANNED. */
export function walletStatus(status) {
  return String(status || "Inactive").toUpperCase();
}

/** LAST, REST. Real display name only. No rank is invented. */
export function personnelName(displayName) {
  const clean = String(displayName || "").trim().replace(/\s+/g, " ");
  if (!clean) return "MEMBER";
  const parts = clean.split(" ");
  if (parts.length === 1) return parts[0].toUpperCase();
  const last = parts[parts.length - 1].toUpperCase();
  const rest = parts.slice(0, -1).join(" ").toUpperCase();
  return `${last}, ${rest}`;
}

export function walletReviewValue(card) {
  const count = Number(card.peer_review_count || 0);
  if (card.peer_review_count != null && count === 0) return "No peer reviews";
  if (card.peer_review_average != null && count > 0) return `${card.peer_review_average} · ${count}`;
  return card.peer_review_label || "No peer reviews";
}

/**
 * storeCard so the pass can carry a strip image. Generic passes cannot.
 * serialNumber and passTypeIdentifier are the caller's existing values.
 * A pass already on a phone keeps that serial and pass type; the next
 * download replaces the generic layout with this store card.
 */
export function etherIdPassJson(card, meta) {
  const backFields = [
    { key: "since", label: "Member since", value: card.member_since_label || "—" },
    { key: "verify", label: "Verify", value: meta.verifyUrl },
  ];
  if (card.birthday_label) {
    backFields.unshift({
      key: "birthday",
      label: "Birthday",
      value: `${card.birthday_label} · self-reported`,
    });
  }

  const auxiliaryFields = [
    { key: "reviews", label: "Reviews", value: walletReviewValue(card) },
    { key: "projects", label: "Projects", value: card.projects_label || "0 completed" },
    { key: "joined", label: "Joined", value: card.member_since_label || "—" },
  ];
  if (card.birthday_label) {
    auxiliaryFields.push({ key: "birthday", label: "Birthday", value: card.birthday_label });
  }

  return {
    formatVersion: 1,
    passTypeIdentifier: meta.passTypeIdentifier,
    serialNumber: meta.serialNumber,
    teamIdentifier: meta.teamIdentifier,
    organizationName: "Ether",
    description: "Ether ID",
    foregroundColor: passColors(card.status).foregroundColor,
    backgroundColor: passColors(card.status).backgroundColor,
    labelColor: passColors(card.status).labelColor,
    storeCard: {
      headerFields: [
        { key: "status", label: "Status", value: walletStatus(card.status) },
      ],
      primaryFields: [
        { key: "name", label: "Member", value: personnelName(card.display_name) },
      ],
      secondaryFields: [
        {
          key: "username",
          label: "Username",
          value: card.username ? `@${String(card.username).replace(/^@+/, "")}` : "No username",
        },
        { key: "passion", label: "Passion", value: card.passion || "—" },
      ],
      auxiliaryFields,
      backFields,
    },
    barcode: {
      format: "PKBarcodeFormatQR",
      message: meta.verifyUrl,
      messageEncoding: "iso-8859-1",
      altText: "Verify",
    },
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: meta.verifyUrl,
        messageEncoding: "iso-8859-1",
        altText: "Verify",
      },
    ],
    webServiceURL: meta.webServiceURL,
    authenticationToken: meta.authenticationToken,
    sharingProhibited: true,
  };
}
