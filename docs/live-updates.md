# Live updates for bug fixes

The iPhone app ships a copy of the website inside the binary. A website deploy does not update App Store or TestFlight users. This is a self-hosted web-layer updater so a bug fix in HTML, CSS, or JavaScript can reach those users without a new App Store review. There is no Capgo cloud and no paid plan.

Use this only for bug fixes and in-scope UI that stay within the app Apple already reviewed. Do not use it to change the app's purpose, add a store, or ship new native code, plugins, permissions, or entitlements. Those still need a new App Store build. Apple’s license agreement 3.3.1 and review guideline 4.7 allow interpreted web updates that keep the reviewed purpose; guideline 2.5.2 still forbids downloading native code.

## How it works

1. The app keeps loading its bundled `dist` from `capacitor://localhost`. `server.url` stays unset.
2. `@capgo/capacitor-updater` checks `https://etherbylcove.com/native-updates` when the app comes to the foreground. `autoUpdate: true` means a downloaded bundle is applied the next time the app goes to the background.
3. That URL is a Cloudflare Pages Function (`functions/native-updates.js`). It reads `public/native-updates/manifest.json` and returns a zip only when the request's native build number matches a native slot in the manifest and `current` points at a bundle the app does not already have. The plugin sends the build number (CFBundleVersion, e.g. `202611222244`) as `version_code`. Its `version_build` field is the marketing version (CFBundleShortVersionString, e.g. `1.0.5`), so the Function keys on `version_code` and uses `version_build` only as a fallback.
4. After JavaScript starts, `notifyLiveUpdateReady()` calls `notifyAppReady()`. If that call does not happen within 10 seconds, the plugin reverts to the last good bundle (or the store binary).
5. Installing a newer App Store or TestFlight binary clears old zips (`resetWhenUpdate: true`). Add a new native slot in the manifest for that build number before you publish a zip for it.

The endpoint and the zip files are ordinary Cloudflare Pages traffic. Pages Functions on the free Workers plan include 100,000 function requests per day (shared with any other Workers, reset at midnight UTC). Static zip and manifest requests do not count toward that cap. The check handler only parses JSON, so it stays under the free plan's 10ms CPU budget. Ether's check volume fits the free plan.

## TestFlight first

The updater is not in App Store 1.0.3 or in 1.0.4. It ships in the next native build that includes this branch (the project is already 1.0.5). After that binary is in TestFlight:

1. Install it on a phone.
2. Publish a small test zip (see below) whose `version_build` matches that TestFlight binary.
3. Background and reopen the app, and confirm the test fix appears.
4. Roll the test zip back with the step below, and confirm the previous bundle or the built-in copy returns.
5. Only then publish a production bug-fix zip, and only after the 1.0.5 binary is on the App Store.

A zip built for one native `version_build` will not be served to any other native build.

## Publish a bug-fix bundle

From a production checkout of the live release branch:

```bash
npm ci
node scripts/live-update-bundle.mjs
```

The script runs the production web build, zips `dist` with `index.html` at the zip root, writes a SHA-256 checksum, and sets `current` in `public/native-updates/manifest.json`. It names the bundle `{marketing}-web.{N}` (for example `1.0.5-web.1`) for the `CURRENT_PROJECT_VERSION` in the Xcode project. You can pass `--version 1.0.5-web.2` or `--native 202611170600`. Use `--skip-build` only if `dist` is already a production build.

Commit the new zip under `public/native-updates/bundles/` and the updated manifest, then deploy the website (Cloudflare Pages). Do not submit a new App Store build for a web-only bug fix.

## Rollback

Rollback is one edit. In `public/native-updates/manifest.json`, set `native[version_build].current` to the previous bundle id, keep that zip listed under `bundles`, commit, and deploy the website only. The next time the app checks, the Function returns that older zip. Leave the broken bundle in `bundles` so you can inspect it; just stop pointing `current` at it.

To stop serving every zip for a native build, set `current` to `null` and deploy the website. Phones stay on whatever bundle they already have, or on the built-in copy after a reinstall or a later store binary.

## Related files

- `capacitor.config.ts` — `CapacitorUpdater` (`updateUrl`, `autoUpdate`, `resetWhenUpdate`)
- `src/lib/liveUpdates.ts` and `src/main.tsx` — `notifyAppReady` on boot
- `functions/native-updates.js` and `functions/_shared/nativeUpdates.js` — the check endpoint
- `public/native-updates/manifest.json` — current bundle per native build
- `scripts/live-update-bundle.mjs` — build, zip, checksum, manifest
