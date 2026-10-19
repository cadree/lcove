import type { CapacitorConfig } from "@capacitor/cli";
import { NATIVE_APP_ID, NATIVE_APP_NAME } from "./src/config/nativeIds";
import { NATIVE_SPLASH_BACKSTOP_MS } from "./src/lib/nativeShellPolicy";

/**
 * Bundle id: com.etherbylcove.app (src/config/nativeIds.ts).
 * The owner registers that id with Apple before archiving.
 *
 * Do not set `server.url`. That key loads a dev server instead of the
 * bundled web assets and must stay unset for TestFlight and App Store builds.
 * `server.iosScheme` is also unset so the WebView keeps the default
 * capacitor://localhost origin. Live streaming calls getUserMedia, which
 * needs that local secure context.
 *
 * `ios.scheme` is the Xcode build scheme (default "App"), not a URL scheme.
 * Auth return links use NATIVE_APP_ID in Info.plist and getAuthRedirectUrl.
 */
const config: CapacitorConfig = {
  appId: NATIVE_APP_ID,
  appName: NATIVE_APP_NAME,
  webDir: "dist",
  ios: {
    contentInset: "always",
    preferredContentMode: "mobile",
    allowsLinkPreview: false,
    backgroundColor: "#080808",
  },
  plugins: {
    SplashScreen: {
      // JS hides this on first paint. The backstop covers a bundle that never
      // runs. launchAutoHide: false with no SplashScreen.hide() left the bear
      // and spinner up for the life of the process.
      launchAutoHide: true,
      launchShowDuration: NATIVE_SPLASH_BACKSTOP_MS,
      backgroundColor: "#080808",
      showSpinner: true,
      spinnerColor: "#ffffff",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#080808",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
