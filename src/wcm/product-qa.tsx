import { useEffect, useState } from "react";
import { getSupabase } from "@/integrations/supabase/client";
import { trackEngagementEvent } from "@/lib/meta-pixel";
import { Btn, Section } from "./ui";

// ---------------------------------------------------------------------------
// Real "viewed recently" signal. product_recent_view_counts() only returns
// products with enough distinct viewers (server-side minimum), so a product
// with little traffic simply has no badge. One fetch is shared by every
// product page and cached for a few minutes.
// ---------------------------------------------------------------------------

type RpcResult = Promise<{ data: unknown; error: { message: string } | null }>;
async function callRpc(fn: string, args: Record<string, unknown>): RpcResult {
  const supabase = await getSupabase();
  return (
    supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => RpcResult }
  ).rpc(fn, args);
}

const VIEW_COUNTS_TTL_MS = 5 * 60 * 1000;
let viewCountsCache: { at: number; counts: Map<string, number> } | null = null;
let viewCountsInflight: Promise<Map<string, number>> | null = null;

function loadViewCounts(): Promise<Map<string, number>> {
  if (viewCountsCache && Date.now() - viewCountsCache.at < VIEW_COUNTS_TTL_MS) {
    return Promise.resolve(viewCountsCache.counts);
  }
  if (!viewCountsInflight) {
    viewCountsInflight = callRpc("product_recent_view_counts", { p_hours: 24, p_min: 10 })
      .then(({ data, error }) => {
        const counts = new Map<string, number>();
        if (!error && Array.isArray(data)) {
          for (const row of data as Array<{ product_id?: string; viewers?: number }>) {
            if (row.product_id && Number(row.viewers) > 0)
              counts.set(row.product_id, Number(row.viewers));
          }
        }
        viewCountsCache = { at: Date.now(), counts };
        return counts;
      })
      .catch(() => new Map<string, number>())
      .finally(() => {
        viewCountsInflight = null;
      });
  }
  return viewCountsInflight;
}

/** Distinct viewers in the last 24h, or null when the product is below the minimum. */
export function useRecentViewCount(productId: string): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadViewCounts().then((counts) => {
      if (!cancelled) setCount(counts.get(productId) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);
  return count;
}

// ---------------------------------------------------------------------------
// Questions & answers
// ---------------------------------------------------------------------------

type PublicQuestion = {
  id: string;
  question: string;
  asker_name: string | null;
  answer: string;
  answered_at: string | null;
};

const VISIBLE_QUESTIONS = 3;

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 14px",
  borderRadius: 11,
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  fontFamily: "inherit",
  fontSize: 14,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  color: "var(--ink-3)",
};

export function ProductQuestions({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, never shown to people

  useEffect(() => {
    let cancelled = false;
    void callRpc("public_product_questions", { p_product_id: productId, p_limit: 20 })
      .then(({ data, error: rpcError }) => {
        if (cancelled || rpcError || !Array.isArray(data)) return;
        setQuestions(data as PublicQuestion[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (question.trim().length < 5) {
      setError("Please write your question (at least 5 characters).");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-product-question`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: productId,
            question: question.trim(),
            name: name.trim(),
            phone: phone.trim(),
            website,
          }),
        },
      );
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok)
        throw new Error(payload?.error || "Could not send your question. Please try again.");
      trackEngagementEvent("QuestionAsked", {
        label: productName,
        source: "product page",
        productIds: [productId],
      });
      setSent(true);
      setFormOpen(false);
      setQuestion("");
      setPhone("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send your question. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const shown = showAll ? questions : questions.slice(0, VISIBLE_QUESTIONS);

  return (
    <Section className="wcm-detail-questions" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontSize: 18, margin: 0, fontWeight: 800, letterSpacing: -0.2 }}>
          Questions about this product
        </h2>
        {!formOpen && (
          <Btn
            size="sm"
            variant="outline"
            onClick={() => {
              setFormOpen(true);
              setSent(false);
            }}
          >
            Ask a question
          </Btn>
        )}
      </div>

      {sent && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--pill-success-bg)",
            color: "var(--pill-success-fg)",
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          Thanks. We'll answer it here soon.
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={submit}
          style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}
        >
          <label style={labelStyle}>
            Your question
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              rows={3}
              required
              placeholder="e.g. Does it come with batteries?"
              style={{ ...fieldStyle, resize: "vertical", minHeight: 76 }}
            />
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
              gap: 10,
            }}
          >
            <label style={labelStyle}>
              Name (optional)
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoComplete="given-name"
                style={fieldStyle}
              />
            </label>
            <label style={labelStyle}>
              WhatsApp number (optional)
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                placeholder="Only if you want a private reply"
                style={fieldStyle}
              />
            </label>
          </div>
          {/* Honeypot: hidden from people and assistive tech, bots fill it. */}
          <input
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            name="website"
            style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
          />
          {error && (
            <div
              role="alert"
              style={{ fontSize: 13, fontWeight: 700, color: "var(--pill-rose-fg)" }}
            >
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send question"}
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => {
                setFormOpen(false);
                setError("");
              }}
            >
              Cancel
            </Btn>
          </div>
        </form>
      )}

      {questions.length === 0 ? (
        !sent && (
          <div style={{ fontSize: 13.5, color: "var(--ink-4)" }}>
            No questions yet. Ask us anything about this product.
          </div>
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {shown.map((q) => (
            <div key={q.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", lineHeight: 1.35 }}>
                {q.question}
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "var(--ink-2)",
                  paddingLeft: 12,
                  borderLeft: "3px solid var(--pill-teal-fg)",
                  whiteSpace: "pre-line",
                }}
              >
                {q.answer}
                <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 4 }}>
                  Wellcare Mart
                  {q.asker_name ? ` · asked by ${q.asker_name}` : ""}
                </div>
              </div>
            </div>
          ))}
          {questions.length > VISIBLE_QUESTIONS && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              style={{
                alignSelf: "flex-start",
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--blue-700)",
              }}
            >
              {showAll ? "Show fewer" : `Show all ${questions.length} questions`}
            </button>
          )}
        </div>
      )}
    </Section>
  );
}
