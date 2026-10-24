function pemToDer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** ES256 JWT for APNs token auth. The key is the .p8 from the Apple account. */
export async function signApnsJwt({ p8, keyId, teamId, nowSeconds }) {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(p8),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", kid: keyId })));
  const payload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ iss: teamId, iat: nowSeconds })),
  );
  const signingInput = new TextEncoder().encode(`${header}.${payload}`);
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, signingInput),
  );
  return `${header}.${payload}.${bytesToBase64Url(signature)}`;
}

/**
 * Empty push. Wallet treats it as "this pass changed" and calls the web service.
 * Topic is the Pass Type ID.
 */
export async function pushPassUpdate({ jwt, pushToken, topic, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://api.push.apple.com/3/device/${pushToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": topic,
      "apns-push-type": "background",
      "apns-priority": "5",
    },
    body: "{}",
  });
  return { ok: response.ok, status: response.status };
}
