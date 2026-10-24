# Apple Wallet passes

Guest confirmation can offer **Add to Apple Wallet**. The button stays hidden until every required secret is set on the Supabase project. No pass is signed without them.

The pass leads with the host name, the event, and the ticket QR. The only Ether line is `Powered by Ether` on the back of the pass.

## Secrets

Set these in the Supabase dashboard for the project that serves the app. Do not commit the values. Do not put them in GitHub Actions. The function deploy workflow overwrites function code, and a secrets step in that workflow would replace whatever is already stored.

| Secret | Required | What it is |
| --- | --- | --- |
| `APPLE_PASS_TYPE_ID` | yes | Pass Type ID, for example `pass.com.etherbylcove.event` |
| `APPLE_TEAM_ID` | yes | 10-character Apple Team ID |
| `APPLE_PASS_CERT` | yes | Pass Type ID certificate, PEM text or base64 PEM |
| `APPLE_PASS_KEY` | yes | Private key for that certificate, PEM text or base64 PEM |
| `APPLE_WWDR_CERT` | yes | Apple Worldwide Developer Relations G4 intermediate, PEM or base64 PEM |
| `APPLE_PASS_KEY_PASSPHRASE` | only if the key has one | Passphrase for `APPLE_PASS_KEY` |

`generate-wallet-pass` checks those five required values. If any one is missing or blank, it returns `{ "configured": false }` and the confirmation screen does not show the button.

## Make the certificate

This uses Cadre's Apple Developer account. Ether does not create the account.

1. Open [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources).
2. Identifiers → Pass Type IDs → register an ID such as `pass.com.etherbylcove.event`. Copy that string into `APPLE_PASS_TYPE_ID`.
3. Membership details shows the Team ID. Copy it into `APPLE_TEAM_ID`.
4. Create a certificate for that Pass Type ID. Apple gives you a `.cer`. On a Mac, add it to Keychain Access.
5. In Keychain Access, export the certificate as a `.p12`, then split it:

   ```sh
   openssl pkcs12 -in pass.p12 -clcerts -nokeys -out pass-cert.pem
   openssl pkcs12 -in pass.p12 -nocerts -nodes -out pass-key.pem
   ```

   If you leave a passphrase on the key, set `APPLE_PASS_KEY_PASSPHRASE` to that passphrase. `nodes` writes a key with no passphrase.

6. Download the Apple WWDR G4 certificate from Apple PKI (`AppleWWDRCAG4.cer`) and convert it:

   ```sh
   openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
   ```

7. Store the PEM files as the secrets above. Either paste the PEM, including the `BEGIN` line, or base64-encode the file (`base64 -i pass-cert.pem`). The function accepts both.

8. Redeploy is not required for secret changes. The next request to `generate-wallet-pass` sees them. Open a confirmation page and the Wallet button appears only after the probe returns `configured: true`.

The library is `passkit-generator` (MIT), loaded inside the edge function only when the secrets are present.
