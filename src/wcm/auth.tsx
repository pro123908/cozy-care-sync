import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icons, WellcareLogo } from "./icons";
import { Btn, TextField } from "./ui";

export type WcmUser = { firstName: string; lastName: string; email: string; initials: string };

export function AuthModal({
  onClose,
  onSignIn,
  notify,
}: {
  onClose: () => void;
  onSignIn: (u: WcmUser) => void;
  notify: (msg: string) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const sendReset = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrs({ email: "Enter a valid email" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) {
        setErrs({ email: error.message });
        return;
      }
      notify("Password reset link sent! Check your inbox.");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (mode === "signup") {
      if (!form.firstName.trim()) e.firstName = "Required";
      if (!form.lastName.trim()) e.lastName = "Required";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (form.password.length < 6) e.password = "At least 6 characters";
    setErrs(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { first_name: form.firstName.trim(), last_name: form.lastName.trim() },
          },
        });
        if (error) {
          setErrs({ password: error.message });
          return;
        }
        if (!data.session) {
          notify("Check your email to confirm your account.");
          onClose();
          return;
        }
        const initials = (form.firstName[0] + (form.lastName[0] || "")).toUpperCase();
        onSignIn({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email,
          initials,
        });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) {
          setErrs({ password: error.message });
          return;
        }
        // Fetch profile name
        const userId = data.user?.id;
        let firstName = "",
          lastName = "";
        if (userId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("first_name,last_name")
            .eq("id", userId)
            .maybeSingle();
          firstName = prof?.first_name || "";
          lastName = prof?.last_name || "";
        }
        if (!firstName) {
          const local = form.email.split("@")[0].replace(/[._-]+/g, " ");
          const parts = local.split(" ").filter(Boolean);
          firstName =
            (parts[0] || "Friend").charAt(0).toUpperCase() + (parts[0] || "Friend").slice(1);
          lastName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "";
        }
        const initials = ((firstName[0] || "U") + (lastName[0] || "")).toUpperCase();
        onSignIn({ firstName, lastName, email: form.email, initials });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay)",
        zIndex: 130,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "fadeIn .2s ease",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--card)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 420,
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          animation: "popIn .25s cubic-bezier(.2,.7,.2,1.2) both",
        }}
      >
        <style>{`
          @keyframes fadeIn{from{opacity:0}to{opacity:1}}
          @keyframes popIn{from{transform:scale(.95);opacity:0}to{transform:scale(1);opacity:1}}
        `}</style>
        <div
          style={{
            padding: "22px 24px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <WellcareLogo size={36} />
            <h2
              style={{
                margin: "10px 0 4px",
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: -0.3,
                color: "var(--ink)",
              }}
            >
              {mode === "forgot"
                ? "Reset password"
                : mode === "signin"
                  ? "Welcome back"
                  : "Create your account"}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-4)" }}>
              {mode === "forgot"
                ? "Enter your email and we'll send a reset link."
                : mode === "signin"
                  ? "Sign in to track orders & checkout faster."
                  : "Join Wellcare Mart in under a minute."}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--card)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-3)",
            }}
          >
            {Icons.close}
          </button>
        </div>
        <div
          style={{ padding: "18px 24px 22px", display: "flex", flexDirection: "column", gap: 12 }}
        >
          {mode === "forgot" ? (
            <>
              <TextField
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={errs.email}
                placeholder="you@example.com"
              />
              <Btn full size="lg" onClick={sendReset} disabled={loading} style={{ marginTop: 4 }}>
                {loading ? "Sending…" : "Send reset link"}
              </Btn>
              <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink-4)" }}>
                <button
                  onClick={() => {
                    setMode("signin");
                    setErrs({});
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--blue-700)",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 13,
                    fontFamily: "inherit",
                  }}
                >
                  Back to sign in
                </button>
              </div>
            </>
          ) : (
            <>
              {mode === "signup" && (
                <div className="wcm-form-2" style={{ display: "grid", gap: 10 }}>
                  <TextField
                    label="First name"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    error={errs.firstName}
                  />
                  <TextField
                    label="Last name"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    error={errs.lastName}
                  />
                </div>
              )}
              <TextField
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={errs.email}
                placeholder="you@example.com"
              />
              <TextField
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                error={errs.password}
                placeholder="••••••••"
              />
              <Btn full size="lg" onClick={submit} disabled={loading} style={{ marginTop: 4 }}>
                {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Btn>
              <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink-4)" }}>
                {mode === "signin" ? "New to Wellcare Mart? " : "Already have an account? "}
                <button
                  onClick={() => {
                    setMode((m) => (m === "signin" ? "signup" : "signin"));
                    setErrs({});
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--blue-700)",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                    fontSize: 13,
                    fontFamily: "inherit",
                  }}
                >
                  {mode === "signin" ? "Create account" : "Sign in"}
                </button>
                {mode === "signin" && (
                  <div style={{ marginTop: 8 }}>
                    <button
                      onClick={() => {
                        setMode("forgot");
                        setErrs({});
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--ink-4)",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: 13,
                        fontFamily: "inherit",
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
