import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/faqs")({
  component: FaqsPage,
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/faqs") }],
    meta: [
      { title: "FAQs - Wellcare Mart" },
      {
        name: "description",
        content:
          "Frequently asked questions about orders, delivery, returns, and products at Wellcare Mart.",
      },
      { property: "og:title", content: "FAQs - Wellcare Mart" },
      {
        property: "og:description",
        content:
          "Frequently asked questions about orders, delivery, returns, and products at Wellcare Mart.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const faqs: Array<{ q: string; a: string }> = [
  {
    q: "How can I track my order?",
    a: "Go to Orders from your account and open the order details page to see current status updates.",
  },
  {
    q: "What are your delivery timelines?",
    a: "Most orders are delivered within 3 to 5 working days depending on your city and product availability.",
  },
  {
    q: "Can I return a product?",
    a: "Yes, eligible products can be returned according to our Returns & Refund policy.",
  },
  {
    q: "How do I contact support?",
    a: "You can use the Contact/Map page for location details and support channels.",
  },
  {
    q: "Are product images and descriptions accurate?",
    a: "We try to keep listings up to date. Minor packaging or brand updates may vary by batch.",
  },
];

function FaqsPage() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 20px 70px" }}>
      <div style={{ marginBottom: 14 }}>
        <Link
          to="/"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ink-4)",
            textDecoration: "none",
          }}
        >
          ← Back to home
        </Link>
      </div>

      <h1
        style={{
          margin: 0,
          fontSize: 30,
          fontWeight: 800,
          color: "var(--ink)",
          letterSpacing: -0.5,
        }}
      >
        Frequently Asked Questions
      </h1>
      <p style={{ margin: "8px 0 20px", color: "var(--ink-4)", fontSize: 14 }}>
        Quick answers about orders, shipping, returns, and support.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {faqs.map((item) => (
          <section
            key={item.q}
            style={{
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>
              {item.q}
            </h2>
            <p style={{ margin: "7px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--ink-3)" }}>
              {item.a}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
