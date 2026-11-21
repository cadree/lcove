import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/cinzel/latin-800.css";
import "@fontsource/dm-mono/latin-400.css";
import "@fontsource/fraunces/latin-400-italic.css";
import "@fontsource/fraunces/latin-700.css";
import "@fontsource/dm-mono/latin-500.css";
import "@fontsource/archivo/latin-400.css";
import "@fontsource/archivo/latin-500.css";
import "@fontsource/archivo/latin-700.css";
import "@fontsource/archivo/latin-800.css";
import App from "./App.tsx";
import "./index.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import { setupDeepLinkHandler, initializeCapacitorApp } from "@/lib/deepLinkHandler";
import { startPushTapListener } from "@/lib/pushTap";

// Ether Application Bootstrap - v2

// Initialize Capacitor deep link handler for native auth
setupDeepLinkHandler();
initializeCapacitorApp();
// Before React renders, so a tap that cold-started the app is not lost.
startPushTapListener();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
