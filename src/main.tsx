import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import * as Sentry from "@sentry/react";
import { registerSW } from "virtual:pwa-register";
import { getRouter } from "./router";
import { initGaLazy } from "./lib/ga";
import "./styles.css";

const router = getRouter();
const isVercelDeployment = !["localhost", "127.0.0.1"].includes(window.location.hostname);

initGaLazy();

// No-ops if VITE_SENTRY_DSN isn't set (e.g. local dev) — Sentry.init with an
// empty dsn just doesn't send anything.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
});

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            fontFamily: "sans-serif",
            textAlign: "center",
          }}
        >
          <div>
            <h1>Something went wrong</h1>
            <p>
              <a href="/">Reload the page</a>
            </p>
          </div>
        </div>
      }
    >
      <RouterProvider router={router} />
    </Sentry.ErrorBoundary>
    {isVercelDeployment && <Analytics />}
  </React.StrictMode>,
);
