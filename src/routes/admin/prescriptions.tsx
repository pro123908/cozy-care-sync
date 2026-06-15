import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { AdminGate } from "@/wcm/admin-access";
import { useWcm } from "@/wcm/context";
import { Icons } from "@/wcm/icons";
import { WellcareLoader } from "@/wcm/loader";
import { NOINDEX_FOLLOW_META, canonicalUrl } from "@/lib/seo";

type PrescriptionRow = Database["public"]["Tables"]["prescription_requests"]["Row"];

const STATUS_OPTIONS = ["Received", "Reviewing", "Contacted", "Closed"] as const;
const PRESCRIPTION_BUCKET = "prescriptions";

export const Route = createFileRoute("/admin/prescriptions")({
  component: AdminPrescriptionsPage,
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/admin/prescriptions") }],
    meta: [{ title: "Admin Prescriptions — Wellcare Mart" }, NOINDEX_FOLLOW_META],
  }),
});

function AdminPrescriptionsPage() {
  const { push } = useWcm();
  const isMobile = useIsMobile();
  const [rows, setRows] = useState<PrescriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<"all" | "open" | "closed">("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadRequests = async () => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("prescription_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      push(error.message || "Failed to load prescription requests", { tone: "rose" });
      setLoading(false);
      return;
    }

    const items = data || [];
    setRows(items);
    setActiveId((current) => current || items[0]?.id || null);
    setLoading(false);
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !q ||
        row.id.toLowerCase().includes(q) ||
        row.contact_name.toLowerCase().includes(q) ||
        row.phone.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q);
      const matchesSegment =
        segment === "all"
          ? true
          : segment === "open"
            ? row.status !== "Closed"
            : row.status === "Closed";
      return matchesQuery && matchesSegment;
    });
  }, [rows, query, segment]);

  const activeRow = useMemo(
    () => filtered.find((row) => row.id === activeId) || filtered[0] || null,
    [filtered, activeId],
  );

  useEffect(() => {
    if (!activeRow) {
      setPreviewUrls([]);
      return;
    }

    let cancelled = false;
    const loadPreviews = async () => {
      setLoadingPreviews(true);
      try {
        const supabase = await getSupabase();
        const signed = await Promise.all(
          activeRow.file_paths.map(async (path) => {
            const { data } = await supabase.storage
              .from(PRESCRIPTION_BUCKET)
              .createSignedUrl(path, 60 * 60);
            return data?.signedUrl || "";
          }),
        );
        if (!cancelled) setPreviewUrls(signed.filter(Boolean));
      } finally {
        if (!cancelled) setLoadingPreviews(false);
      }
    };

    void loadPreviews();
    return () => {
      cancelled = true;
    };
  }, [activeRow]);

  const updateStatus = async (id: string, status: (typeof STATUS_OPTIONS)[number]) => {
    setSavingId(id);
    const supabase = await getSupabase();
    const { error } = await supabase.from("prescription_requests").update({ status }).eq("id", id);
    setSavingId(null);

    if (error) {
      push(error.message || "Could not update request status", { tone: "rose" });
      return;
    }

    setRows((current) => current.map((row) => (row.id === id ? { ...row, status } : row)));
    push("Prescription request updated", { tone: "green" });
  };

  return (
    <AdminGate>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "30px 20px 90px" }}>
        <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1, letterSpacing: -0.4 }}>
          Prescription Requests
        </h1>
        <p style={{ marginTop: 8, marginBottom: 22, color: "var(--ink-4)", fontSize: 14 }}>
          Review uploaded prescriptions and follow up with customers to complete their orders.
        </p>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: isMobile ? "1fr" : "minmax(320px, .95fr) minmax(0, 1.2fr)",
          }}
        >
          <div style={panelStyle}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, phone, email, or request ID"
                style={{ ...searchStyle, flex: 1 }}
              />
              <select
                value={segment}
                onChange={(event) => setSegment(event.target.value as typeof segment)}
                style={searchStyle}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {loading ? (
                <WellcareLoader label="Loading requests" compact />
              ) : filtered.length === 0 ? (
                <div style={{ color: "var(--ink-4)", fontSize: 14 }}>
                  No prescription requests found.
                </div>
              ) : (
                filtered.map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setActiveId(row.id)}
                    style={{
                      ...requestCardStyle,
                      borderColor: activeRow?.id === row.id ? "var(--blue-500)" : "var(--line)",
                      background: activeRow?.id === row.id ? "var(--pill-info-bg)" : "var(--card)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontWeight: 800, color: "var(--ink)" }}>{row.contact_name}</div>
                      <StatusBadge status={row.status} />
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 3 }}>
                      {row.phone}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 3 }}>
                      {row.email || "No email provided"}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        marginTop: 10,
                        fontSize: 11.5,
                        color: "var(--ink-4)",
                      }}
                    >
                      <span>{new Date(row.created_at).toLocaleString()}</span>
                      <span>
                        {row.file_paths.length} file{row.file_paths.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div style={panelStyle}>
            {activeRow ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={sectionLabelStyle}>Request</div>
                    <div
                      style={{
                        marginTop: 4,
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {activeRow.id}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <select
                      value={activeRow.status}
                      onChange={(event) =>
                        updateStatus(
                          activeRow.id,
                          event.target.value as (typeof STATUS_OPTIONS)[number],
                        )
                      }
                      disabled={savingId === activeRow.id}
                      style={searchStyle}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                  }}
                >
                  <DetailCard label="Customer" value={activeRow.contact_name} />
                  <DetailCard label="Phone" value={activeRow.phone} />
                  <DetailCard label="Email" value={activeRow.email || "Not provided"} />
                  <DetailCard label="City" value={activeRow.city || "Not provided"} />
                </div>

                <div>
                  <div style={sectionLabelStyle}>Notes</div>
                  <div style={{ ...detailBoxStyle, minHeight: 88 }}>
                    {activeRow.notes || "No notes provided."}
                  </div>
                </div>

                <div>
                  <div style={sectionLabelStyle}>Attachments</div>
                  {loadingPreviews ? (
                    <WellcareLoader label="Loading files" compact />
                  ) : previewUrls.length === 0 ? (
                    <div style={{ color: "var(--ink-4)", fontSize: 14 }}>
                      No uploaded files found.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                      }}
                    >
                      {previewUrls.map((url, index) => {
                        const path = activeRow.file_paths[index] || "";
                        const isPdf = path.toLowerCase().endsWith(".pdf");
                        return isPdf ? (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              ...detailBoxStyle,
                              textDecoration: "none",
                              color: "var(--ink)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              {Icons.filePlus} PDF attachment
                            </span>
                            <span style={{ color: "var(--blue-700)", fontWeight: 700 }}>Open</span>
                          </a>
                        ) : (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ textDecoration: "none" }}
                          >
                            <img
                              src={url}
                              alt={`Prescription file ${index + 1}`}
                              style={{
                                width: "100%",
                                aspectRatio: "1 / 1",
                                objectFit: "cover",
                                borderRadius: 14,
                                border: "1px solid var(--line)",
                                background: "var(--bg-elev)",
                              }}
                            />
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--ink-4)", fontSize: 14 }}>
                Select a request to view details.
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminGate>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailBoxStyle}>
      <div style={sectionLabelStyle}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    Received: { bg: "var(--pill-info-bg)", color: "var(--pill-info-fg)" },
    Reviewing: { bg: "var(--pill-warn-bg)", color: "#b45309" },
    Contacted: { bg: "#ede9fe", color: "#6d28d9" },
    Closed: { bg: "var(--pill-ok-bg)", color: "var(--pill-ok-fg)" },
  };
  const style = styles[status] || { bg: "var(--chip-2)", color: "var(--ink-2)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        background: style.bg,
        color: style.color,
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {status}
    </span>
  );
}

const panelStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: 16,
  padding: 18,
};

const searchStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--line)",
  background: "var(--bg-elev)",
  fontSize: 13,
  fontFamily: "inherit",
  color: "var(--ink)",
};

const requestCardStyle: CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 14,
  background: "var(--card)",
  padding: 14,
  textAlign: "left",
  cursor: "pointer",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--ink-4)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.35,
  marginBottom: 6,
};

const detailBoxStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid var(--line)",
  background: "var(--bg-elev)",
  padding: 14,
};
