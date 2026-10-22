import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LiveApp } from "./LiveApp";
import { FootprintPage } from "./footprint/FootprintPage";
import { MarketProfilePage } from "./marketProfile/MarketProfilePage";
import { LiquidityPage } from "./liquidity/LiquidityPage";
import { ErrorBoundary } from "./ErrorBoundary";
import { routeForPathname } from "./routes";
import { registerServiceWorker } from "./webPush";
import { RithmicAdminPage } from "./admin/RithmicAdminPage";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

const route = routeForPathname(window.location.pathname);
if (window.location.pathname.replace(/\/+$/, "") === "/footprint") {
  window.history.replaceState(null, "", "/fp");
}
const app =
  route === "footprint" ? (
    <FootprintPage />
  ) : route === "marketProfile" ? (
    <MarketProfilePage />
  ) : route === "liquidity" ? (
    <LiquidityPage />
  ) : route === "admin" ? (
    <RithmicAdminPage />
  ) : (
    <LiveApp />
  );
registerServiceWorker();

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      {app}
    </ErrorBoundary>
  </StrictMode>,
);
