import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
<<<<<<< HEAD
  appId: 'app.lovable.e07d9c457fd949f78f3cc7d5998be668',
  appName: 'ETHER',
  webDir: 'dist',
  // NOTE: Remove 'server' block for App Store/TestFlight production builds
  // server: {
  //   url: 'https://e07d9c45-7fd9-49f7-8f3c-c7d5998be668.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
    // Enable URL scheme handling for auth deep links
    scheme: 'app.lovable.e07d9c457fd949f78f3cc7d5998be668'
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#080808',
      showSpinner: true,
      spinnerColor: '#ffffff',
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#080808'
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    CapacitorCookies: {
      enabled: true
    },
=======
  appId: 'com.lcove.ether',
  appName: 'ETHER',
  webDir: 'dist',
  bundledWebRuntime: false,

  server: {
    url: 'https://etherbylcove.com',
    cleartext: true
  },

  plugins: {
>>>>>>> ebb7643 (prep iOS rebuild – env, capacitor, deps)
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
<<<<<<< HEAD
=======

>>>>>>> ebb7643 (prep iOS rebuild – env, capacitor, deps)
