// Unsigned pieces of an Apple Wallet pass, plus a PKCS7 detached signature.
// Manifest hashes are SHA-1 because that is the PassKit manifest rule.

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function crc32(bytes) {
  let crc = ~0;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return ~crc >>> 0;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function zlibStore(data) {
  const parts = [Uint8Array.from([0x78, 0x01])];
  if (data.length === 0) {
    parts.push(Uint8Array.from([0x01, 0x00, 0x00, 0xff, 0xff]));
  }
  let offset = 0;
  while (offset < data.length) {
    const take = Math.min(65535, data.length - offset);
    const last = offset + take >= data.length;
    const nlen = (~take) & 0xffff;
    const header = new Uint8Array(5);
    header[0] = last ? 0x01 : 0x00;
    header[1] = take & 0xff;
    header[2] = (take >> 8) & 0xff;
    header[3] = nlen & 0xff;
    header[4] = (nlen >> 8) & 0xff;
    parts.push(header, data.subarray(offset, offset + take));
    offset += take;
  }
  const tail = new Uint8Array(4);
  new DataView(tail.buffer).setUint32(0, adler32(data));
  parts.push(tail);
  return concat(parts);
}

function chunk(type, data) {
  const body = new Uint8Array(4 + type.length + data.length + 4);
  const view = new DataView(body.buffer);
  view.setUint32(0, data.length);
  body.set(new TextEncoder().encode(type), 4);
  body.set(data, 8);
  const crc = crc32(body.subarray(4, 8 + data.length));
  view.setUint32(8 + data.length, crc);
  return body;
}

function encodeRgbPng(width, height, rows) {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlibStore(rows)),
    chunk("IEND", new Uint8Array()),
  ]);
}

function rgbRows(width, height, paint) {
  const rows = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    rows[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y, width, height);
      const i = row + 1 + x * 3;
      rows[i] = r;
      rows[i + 1] = g;
      rows[i + 2] = b;
    }
  }
  return rows;
}

/** Neutral near-black square with a pink bar. Event tickets still use this. */
export function solidPng(width, height) {
  return encodeRgbPng(width, height, rgbRows(width, height, (_x, y, _w, h) => {
    const band = y > h * 0.62 && y < h * 0.78;
    return band ? [245, 166, 207] : [18, 18, 18];
  }));
}

const MARK_BLACK = [16, 14, 12];
const MARK_CREAM = [236, 231, 220];
const MARK_RED = [196, 20, 45];

/**
 * Warm near-black square with a cream E and a deep-red middle bar.
 * Lock-screen icon for the Ether ID. The pass front is the strip image.
 */
export function etherMarkPng(width, height) {
  return encodeRgbPng(width, height, rgbRows(width, height, (x, y, w, h) => {
    const margin = Math.floor(Math.min(w, h) * 0.2);
    const x0 = margin;
    const y0 = margin;
    const x1 = w - margin;
    const y1 = h - margin;
    const stem = Math.max(1, Math.round((x1 - x0) * 0.22));
    const bar = Math.max(1, Math.round((y1 - y0) * 0.18));
    const midY = Math.round((y0 + y1) / 2 - bar / 2);
    const inStem = x >= x0 && x < x0 + stem && y >= y0 && y < y1;
    const inTop = y >= y0 && y < y0 + bar && x >= x0 && x < x1;
    const inBottom = y >= y1 - bar && y < y1 && x >= x0 && x < x1;
    const inMiddle = y >= midY && y < midY + bar && x >= x0 && x < x1;
    if (inMiddle) return MARK_RED;
    if (inStem || inTop || inBottom) return MARK_CREAM;
    return MARK_BLACK;
  }));
}

export function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length + file.data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(file.data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return concat([...locals, ...centrals, end]);
}

async function sha1Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadForge() {
  try {
    const mod = await import("node-forge");
    return mod.default ?? mod;
  } catch {
    const mod = await import("npm:node-forge@1.3.1");
    return mod.default ?? mod;
  }
}

export async function signManifest(manifestBytes, { certPem, keyPem, wwdrPem }) {
  const forge = await loadForge();
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);
  const wwdr = forge.pki.certificateFromPem(wwdrPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestBytes);
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  const signature = new Uint8Array(der.length);
  for (let i = 0; i < der.length; i += 1) signature[i] = der.charCodeAt(i) & 0xff;
  return signature;
}

export function passImages() {
  return [
    { name: "icon.png", data: solidPng(29, 29) },
    { name: "icon@2x.png", data: solidPng(58, 58) },
    { name: "logo.png", data: solidPng(160, 50) },
    { name: "logo@2x.png", data: solidPng(320, 100) },
  ];
}

/** Ether ID icons only. No logo image, so the pass does not show the old pink bar. */
export function etherIdPassImages() {
  return [
    { name: "icon.png", data: etherMarkPng(29, 29) },
    { name: "icon@2x.png", data: etherMarkPng(58, 58) },
    { name: "icon@3x.png", data: etherMarkPng(87, 87) },
  ];
}

export async function buildPkpass(files, certs) {
  const encoded = files.map((file) => ({
    name: file.name,
    data: typeof file.data === "string" ? new TextEncoder().encode(file.data) : file.data,
  }));
  const manifest = {};
  for (const file of encoded) {
    manifest[file.name] = await sha1Hex(file.data);
  }
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const signature = await signManifest(manifestBytes, certs);
  return zipStore([
    ...encoded,
    { name: "manifest.json", data: manifestBytes },
    { name: "signature", data: signature },
  ]);
}
