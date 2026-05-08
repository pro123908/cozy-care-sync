import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import { useWcm } from "@/wcm/context";
import { Btn } from "@/wcm/ui";
import { Icons } from "@/wcm/icons";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user, setUser, push } = useWcm();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [saving, setSaving] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (!user) {
    navigate({ to: "/" });
    return null;
  }

  const saveProfile = async () => {
    if (!firstName.trim()) return;
    setSaving(true);
    try {
      const supabase = await getSupabase();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        push("Session expired. Please sign in again.");
        return;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ first_name: firstName.trim(), last_name: lastName.trim() })
        .eq("id", session.user.id);
      if (!error) {
        setUser({
          ...user,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          initials:
            (firstName.trim()[0] ?? "").toUpperCase() + (lastName.trim()[0] ?? "").toUpperCase(),
        });
        push("Profile updated");
      } else {
        push("Failed to save profile");
      }
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordReset = async () => {
    setResetting(true);
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (!error) {
        setResetSent(true);
        push("Password reset link sent to your email");
      } else {
        push("Failed to send reset link");
      }
    } finally {
      setResetting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--line)",
    background: "var(--bg-elev)",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    color: "var(--ink)",
  };

  return (
    <div
      style={{
        maxWidth: 540,
        margin: "40px auto",
        padding: "0 20px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <button
        onClick={() => navigate({ to: "/" })}
        style={{
          background: "none",
          border: "none",
          color: "var(--ink-3)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          padding: 0,
          alignSelf: "flex-start",
        }}
      >
        {Icons.chevL} Back
      </button>

      <div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>Account settings</div>
        <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 4 }}>{user.email}</div>
      </div>

      {/* Profile info */}
      <div
        style={{
          background: "var(--card)",
          borderRadius: 18,
          border: "1px solid var(--line)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>Profile</div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-3)",
                display: "block",
                marginBottom: 6,
              }}
            >
              First name
            </label>
            <input
              style={inputStyle}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-3)",
                display: "block",
                marginBottom: 6,
              }}
            >
              Last name
            </label>
            <input
              style={inputStyle}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
          </div>
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink-3)",
              display: "block",
              marginBottom: 6,
            }}
          >
            Email
          </label>
          <input
            style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
            value={user.email}
            disabled
          />
        </div>
        <Btn onClick={saveProfile} disabled={saving} icon={Icons.check}>
          {saving ? "Saving…" : "Save changes"}
        </Btn>
      </div>

      {/* Password */}
      <div
        style={{
          background: "var(--card)",
          borderRadius: 18,
          border: "1px solid var(--line)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>Password</div>
        <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
          We'll send a password reset link to <strong>{user.email}</strong>.
        </div>
        {resetSent ? (
          <div
            style={{
              fontSize: 13,
              color: "var(--pill-success-fg)",
              background: "var(--pill-success-bg)",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 600,
            }}
          >
            Reset link sent — check your inbox.
          </div>
        ) : (
          <Btn
            variant="outline"
            onClick={sendPasswordReset}
            disabled={resetting}
            icon={Icons.shield}
          >
            {resetting ? "Sending…" : "Send password reset link"}
          </Btn>
        )}
      </div>
    </div>
  );
}
