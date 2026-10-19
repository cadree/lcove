import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import { setupDeepLinkHandler, initializeCapacitorApp } from "@/lib/deepLinkHandler";
import { bootNativeShell } from "@/lib/nativeShell";

// Ether Application Bootstrap - v2

// Hide the native splash without waiting on auth or network, then listen
// for auth return links.
bootNativeShell();
setupDeepLinkHandler();
initializeCapacitorApp();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
