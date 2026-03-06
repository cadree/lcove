

## Fix: Replace Lovable Favicon with Ether Bear Logo

The current `public/favicon.png` is still the default Lovable icon. The bear logo exists at `src/assets/ether-bear-logo.png` but it needs to be copied to `public/favicon.png` to replace the default.

### Changes

1. **Copy bear logo to public directory** — Overwrite `public/favicon.png` with the Ether bear logo (`src/assets/ether-bear-logo.png`). This single change updates:
   - Browser tab favicon
   - Apple touch icon
   - PWA manifest icons
   - OG image fallback
   - Google search result icon

2. **Also overwrite `public/favicon.ico`** with the bear logo for legacy browser support.

No HTML or manifest changes needed — they already reference `/favicon.png`.

Note: Google's search result icons are cached and may take days/weeks to update after the fix is deployed.

