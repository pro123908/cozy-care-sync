import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { registerSW } from "virtual:pwa-register";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();
const isVercelDeployment = !["localhost", "127.0.0.1"].includes(window.location.hostname);

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    {isVercelDeployment && <Analytics />}
  </React.StrictMode>,
);
