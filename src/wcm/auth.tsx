import React, { useState } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import { Icons, WellcareLogo } from "./icons";
import { Btn, TextField } from "./ui";

export type WcmRole = "customer" | "staff" | "admin";

export type WcmUser = {
  firstName: string;
  lastName: string;
  email: string;
  initials: string;
  role: WcmRole;
};

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

  const signInWithGoogle = async () => {
    const supabase = await getSupabase();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const sendReset = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrs({ email: "Enter a valid email" });
      return;
    }
    setLoading(true);
    try {
      const supabase = await getSupabase();
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
      const supabase = await getSupabase();
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
          role: "customer",
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
        let role: WcmRole = "customer";
        if (userId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("first_name,last_name,role")
            .eq("id", userId)
            .maybeSingle();
          firstName = prof?.first_name || "";
          lastName = prof?.last_name || "";
          role = (prof as { role?: WcmRole } | null)?.role || "customer";
        }
        if (!firstName) {
          const local = form.email.split("@")[0].replace(/[._-]+/g, " ");
          const parts = local.split(" ").filter(Boolean);
          firstName =
            (parts[0] || "Friend").charAt(0).toUpperCase() + (parts[0] || "Friend").slice(1);
          lastName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "";
        }
        const initials = ((firstName[0] || "U") + (lastName[0] || "")).toUpperCase();
        onSignIn({ firstName, lastName, email: form.email, initials, role });
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
              <button
                onClick={signInWithGoogle}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  width: "100%",
                  padding: "11px 16px",
                  borderRadius: 12,
                  border: "1.5px solid var(--line)",
                  background: "var(--card)",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  transition: "background .15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elev)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--card)")}
              >
                <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.14 0 5.95 1.08 8.17 2.84l6.1-6.1C34.46 3.1 29.5 1 24 1 14.82 1 7.07 6.48 3.64 14.18l7.1 5.52C12.4 13.6 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.1 24.5c0-1.57-.14-3.09-.4-4.55H24v8.6h12.4c-.54 2.9-2.16 5.36-4.6 7.02l7.1 5.52C43.24 37.3 46.1 31.38 46.1 24.5z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.74 28.3A14.56 14.56 0 0 1 9.5 24c0-1.5.26-2.96.72-4.3l-7.1-5.52A23.93 23.93 0 0 0 0 24c0 3.86.92 7.5 2.56 10.72l7.1-5.52z"
                    transform="translate(.08 0)"
                  />
                  <path
                    fill="#34A853"
                    d="M24 47c5.5 0 10.12-1.82 13.5-4.96l-7.1-5.52c-1.82 1.22-4.14 1.98-6.4 1.98-6.26 0-11.6-4.1-13.26-9.7l-7.1 5.52C7.07 41.52 14.82 47 24 47z"
                  />
                </svg>
                Continue with Google
              </button>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  color: "var(--ink-4)",
                  fontSize: 12,
                }}
              >
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                or
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              </div>
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
