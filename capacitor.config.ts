import type { CapacitorConfig } from "@capacitor/cli";
import { NATIVE_APP_ID, NATIVE_APP_NAME } from "./src/config/nativeIds";

/**
 * CONFIRM WITH CADRE: appId is a placeholder (reverse-domain of
 * etherbylcove.com). It is not registered in Apple Developer or Google Play.
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
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
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
