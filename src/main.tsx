import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupDeepLinkHandler, initializeCapacitorApp } from "@/lib/deepLinkHandler";

// Ether Application Bootstrap - v2

// Initialize Capacitor deep link handler for native auth
setupDeepLinkHandler();
initializeCapacitorApp();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
