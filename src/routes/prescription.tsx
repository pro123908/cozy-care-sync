import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties, type ChangeEvent, type ReactNode } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { Icons } from "@/wcm/icons";
import { Btn, Section } from "@/wcm/ui";
import { useWcm } from "@/wcm/context";

const PRESCRIPTION_BUCKET = "prescriptions";
const MAX_FILES = 4;
const MAX_FILE_MB = 6;

export const Route = createFileRoute("/prescription")({
  component: PrescriptionPage,
  head: () => ({
    meta: [
      { title: "Upload Prescription — Wellcare Mart" },
      {
        name: "description",
        content:
          "Upload your prescription or medicine list and our team will review it and contact you for order confirmation.",
      },
    ],
  }),
});

function PrescriptionPage() {
  const { user, push } = useWcm();
  const isMobile = useIsMobile();
  const [form, setForm] = useState({
    contact_name: user ? `${user.firstName} ${user.lastName}`.trim() : "",
    phone: "",
    email: user?.email || "",
    city: "Karachi",
    notes: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const canSubmit =
    form.contact_name.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.city.trim().length > 0 &&
    files.length > 0;

  const selectedFileSummary = useMemo(
    () => files.map((file) => `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`),
    [files],
  );

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onPickFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files || []);
    if (incoming.length === 0) return;

    const merged = [...files, ...incoming].slice(0, MAX_FILES);
    const valid = merged.filter((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      const accepted = file.type.startsWith("image/") || extension === "pdf";
      if (!accepted) {
        push(`Unsupported file type: ${file.name}`, { tone: "rose" });
        return false;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        push(`${file.name} must be smaller than ${MAX_FILE_MB}MB.`, { tone: "rose" });
        return false;
      }
      return true;
    });

    setFiles(valid);
    event.target.value = "";
  };

  const removeFileAt = (index: number) => {
    setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };

  const submit = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const supabase = await getSupabase();
      const requestId = crypto.randomUUID();
      const uploadedPaths: string[] = [];

      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
        const safeName = file.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
        const path = `requests/${requestId}/${Date.now()}-${safeName || `file.${extension}`}`;
        const { error: uploadError } = await supabase.storage
          .from(PRESCRIPTION_BUCKET)
          .upload(path, file, { upsert: true, cacheControl: "3600" });

        if (uploadError) {
          push(uploadError.message || "Could not upload prescription files right now.", {
            tone: "rose",
          });
          return;
        }
        uploadedPaths.push(path);
      }

      const { error } = await supabase.from("prescription_requests").insert({
        id: requestId,
        user_id: null,
        contact_name: form.contact_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        city: form.city.trim(),
        notes: form.notes.trim(),
        file_paths: uploadedPaths,
      });

      if (error) {
        push(error.message || "Could not submit your prescription request.", { tone: "rose" });
        return;
      }

      setSubmittedId(requestId);
      setFiles([]);
      push("Prescription uploaded successfully.", { tone: "green" });
    } catch {
      push("Could not submit your prescription right now. Please try again.", { tone: "rose" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "30px 20px 90px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <div style={eyebrowStyle}>{Icons.filePlus} Prescription / Instant order</div>
          <h1 style={{ margin: "14px 0 0", fontSize: 34, lineHeight: 1.05, letterSpacing: -0.6 }}>
            Upload your prescription and we’ll help you place the order.
          </h1>
          <p
            style={{
              margin: "10px 0 0",
              color: "var(--ink-4)",
              fontSize: 15,
              maxWidth: 760,
              lineHeight: 1.6,
            }}
          >
            Share clear images or a PDF of your prescription, plus your contact details. Our team
            will review it and contact you to confirm availability and complete the order.
          </p>
        </div>

        {submittedId ? (
          <Section style={{ padding: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--green-700)",
                  fontWeight: 800,
                }}
              >
                {Icons.check} Prescription request received
              </div>
              <div style={{ color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>
                Your request reference is <strong>{submittedId}</strong>. We’ll contact you on the
                provided phone number after reviewing the prescription.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Btn variant="solid" onClick={() => setSubmittedId(null)} icon={Icons.filePlus}>
                  Upload another
                </Btn>
                <Link to="/" style={{ textDecoration: "none" }}>
                  <Btn variant="outline" icon={Icons.home}>
                    Back to shop
                  </Btn>
                </Link>
              </div>
            </div>
          </Section>
        ) : (
          <div
            className="wcm-prescription-grid"
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.4fr) minmax(280px, .8fr)",
            }}
          >
            <Section style={{ padding: 22 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                  className="wcm-prescription-fields-2"
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  }}
                >
                  <Field
                    label="Full name"
                    value={form.contact_name}
                    onChange={(value) => updateField("contact_name", value)}
                  />
                  <Field
                    label="Phone number"
                    value={form.phone}
                    onChange={(value) => updateField("phone", value)}
                    placeholder="03xx xxxxxxx"
                  />
                </div>
                <div
                  className="wcm-prescription-fields-2"
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  }}
                >
                  <Field
                    label="Email (optional)"
                    value={form.email}
                    onChange={(value) => updateField("email", value)}
                    placeholder="name@example.com"
                  />
                  <Field
                    label="City"
                    value={form.city}
                    onChange={(value) => updateField("city", value)}
                  />
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    rows={5}
                    placeholder="Mention any specific brand, dosage, or urgency details."
                    style={textareaStyle}
                  />
                </div>
                <div>
                  <Label>Prescription files</Label>
                  <label style={uploadLabelStyle}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 700,
                        color: "var(--ink)",
                      }}
                    >
                      {Icons.filePlus} Upload images or PDF
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-4)" }}>
                      Up to {MAX_FILES} files, max {MAX_FILE_MB}MB each. JPG, PNG, WEBP, GIF, or
                      PDF.
                    </div>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={onPickFiles}
                      style={{ display: "none" }}
                    />
                  </label>
                  {selectedFileSummary.length > 0 && (
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}
                    >
                      {selectedFileSummary.map((summary, index) => (
                        <div key={`${summary}-${index}`} style={fileRowStyle}>
                          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{summary}</div>
                          <button onClick={() => removeFileAt(index)} style={textButtonStyle}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                    By submitting, you confirm these files belong to you or the patient you are
                    ordering for.
                  </div>
                  <Btn
                    variant="solid"
                    onClick={submit}
                    disabled={!canSubmit || submitting}
                    icon={Icons.filePlus}
                  >
                    {submitting ? "Submitting…" : "Submit prescription"}
                  </Btn>
                </div>
              </div>
            </Section>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Section style={{ padding: 20 }}>
                <div style={sideTitleStyle}>What happens next</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                  {[
                    "We review the prescription and product availability.",
                    "We contact you to confirm details and pricing.",
                    "Your order is then placed and tracked like a normal order.",
                  ].map((item) => (
                    <div
                      key={item}
                      style={{
                        display: "flex",
                        gap: 10,
                        color: "var(--ink-3)",
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ color: "var(--green-700)", marginTop: 2 }}>{Icons.check}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section style={{ padding: 20 }}>
                <div style={sideTitleStyle}>Helpful tips</div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginTop: 12,
                    fontSize: 13.5,
                    color: "var(--ink-3)",
                  }}
                >
                  <div>Upload clear photos taken in good light.</div>
                  <div>Include all pages if the prescription has multiple medicines.</div>
                  <div>Add notes if you prefer a specific brand or strength.</div>
                </div>
              </Section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

const eyebrowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  borderRadius: 99,
  background: "var(--pill-info-bg)",
  color: "var(--blue-700)",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.35,
  textTransform: "uppercase",
};

const sideTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.35,
  textTransform: "uppercase",
  color: "var(--ink-4)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "var(--bg-elev)",
  fontSize: 14,
  fontFamily: "inherit",
  color: "var(--ink)",
  outline: "none",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 110,
};

const uploadLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 18,
  borderRadius: 16,
  border: "1px dashed var(--line)",
  background: "var(--bg-elev)",
  cursor: "pointer",
};

const fileRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  background: "var(--card)",
  border: "1px solid var(--line)",
};

const textButtonStyle: CSSProperties = {
  border: "none",
  background: "none",
  color: "var(--blue-700)",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  padding: 0,
};
