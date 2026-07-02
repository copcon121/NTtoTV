import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LiveApp } from "./LiveApp";
import { FootprintPage } from "./footprint/FootprintPage";
import { ErrorBoundary } from "./ErrorBoundary";
import { routeForPathname } from "./routes";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

const route = routeForPathname(window.location.pathname);
const app = route === "footprint" ? <FootprintPage /> : <LiveApp />;

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      {app}
    </ErrorBoundary>
  </StrictMode>,
);
