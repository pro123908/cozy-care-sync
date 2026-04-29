import React from "react";
import { Link } from "@tanstack/react-router";
import { useWcm } from "@/wcm/context";
import { Btn } from "@/wcm/ui";
import { Icons } from "@/wcm/icons";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, setAuthOpen } = useWcm();

  if (!user) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "var(--grad-soft)",
            color: "var(--blue-700)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          {Icons.shield}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Sign in as admin</div>
        <div style={{ color: "var(--ink-4)", fontSize: 14, marginBottom: 20 }}>
          This area is available to store admins only.
        </div>
        <Btn onClick={() => setAuthOpen(true)} icon={Icons.user}>
          Sign in
        </Btn>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "var(--pill-rose-bg)",
            color: "var(--pill-rose-fg)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          {Icons.close}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Access denied</div>
        <div style={{ color: "var(--ink-4)", fontSize: 14, marginBottom: 20 }}>
          Your account does not have admin permissions.
        </div>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid var(--line)",
            textDecoration: "none",
            color: "var(--ink)",
            fontWeight: 700,
          }}
        >
          Back to shop
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
