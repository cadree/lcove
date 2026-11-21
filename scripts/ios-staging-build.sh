#!/usr/bin/env bash
# Builds a development-signed STAGING Ether app and installs it on a connected iPhone.
# It uses the same bundle id as the App Store app, so it REPLACES Ether on that phone.
# Reinstall from TestFlight/App Store afterwards to go back to production.
#
# Needs, in the environment (never commit them):
#   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID  (staging)
#   VITE_PUBLIC_WEB_ORIGIN   staging website, e.g. https://codex-pending-vouch-recovery.ether-staging.pages.dev
#   DEVICE_ID                from `xcrun devicectl list devices` (state must be "available")
# Staging Supabase also needs APNS_ENV=sandbox plus the APPLE_APNS_* secrets.
set -euo pipefail
cd "$(dirname "$0")/.."
PROD_REF=aykopqinnnssxdhxqruo
: "${VITE_SUPABASE_URL:?}" "${VITE_SUPABASE_PUBLISHABLE_KEY:?}" "${VITE_SUPABASE_PROJECT_ID:?}" "${VITE_PUBLIC_WEB_ORIGIN:?}" "${DEVICE_ID:?}"
case "$VITE_SUPABASE_URL $VITE_SUPABASE_PROJECT_ID" in *"$PROD_REF"*) echo "Refusing: this is the production project." >&2; exit 1;; esac
case "$VITE_PUBLIC_WEB_ORIGIN" in *etherbylcove.com*) echo "Refusing: staging links must not use etherbylcove.com." >&2; exit 1;; esac

# Outside the repo so eslint never scans build output.
DERIVED="${DERIVED_DATA:-$HOME/Library/Developer/Xcode/DerivedData/ether-staging}"

npm run build
npx cap sync ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "id=$DEVICE_ID" -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates \
  CODE_SIGN_ENTITLEMENTS=App/App.staging.entitlements build
APP="$DERIVED/Build/Products/Debug-iphoneos/App.app"
xcrun devicectl device install app --device "$DEVICE_ID" "$APP"
echo "Installed staging build. dist/ and ios/App/App/public now hold STAGING assets;"
echo "run a production build before any release archive."
