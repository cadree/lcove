/** Wallet status is the live word in capitals, so a ban reads BANNED. */
export function walletStatus(status) {
  return String(status || "Inactive").toUpperCase();
}

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

  return {
    formatVersion: 1,
    passTypeIdentifier: meta.passTypeIdentifier,
    serialNumber: meta.serialNumber,
    teamIdentifier: meta.teamIdentifier,
    organizationName: "Ether",
    description: "Ether ID",
    logoText: "Ether",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(18, 18, 18)",
    labelColor: "rgb(245, 166, 207)",
    generic: {
      primaryFields: [
        { key: "name", label: "Member", value: card.display_name || "Member" },
      ],
      secondaryFields: [
        {
          key: "username",
          label: "Username",
          value: card.username ? `@${card.username}` : "No username",
        },
        { key: "status", label: "Status", value: walletStatus(card.status) },
      ],
      auxiliaryFields: [
        { key: "passion", label: "Passion", value: card.passion || "—" },
        { key: "reviews", label: "Peer reviews", value: card.peer_review_label || "No peer reviews" },
        { key: "projects", label: "Projects", value: card.projects_label || "0 completed" },
      ],
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
