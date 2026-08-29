import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/privacy") }],
    meta: [
      { title: "Privacy Policy - Wellcare Mart" },
      {
        name: "description",
        content: "How Wellcare Mart collects, uses, and protects customer information.",
      },
      { property: "og:title", content: "Privacy Policy - Wellcare Mart" },
      {
        property: "og:description",
        content: "How Wellcare Mart collects, uses, and protects customer information.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "28px 16px 70px" }}>
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
        Privacy Policy
      </h1>

      <div style={{ marginTop: 18, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.7 }}>
        <p>
          Wellcare Mart respects your privacy. We collect basic customer information such as name, phone number,
          delivery address, and order details only for processing orders, deliveries, customer support, and service
          improvement.
        </p>
        <p>
          We do not sell or misuse customer data. Customer information may only be shared with delivery partners or
          service providers when required to complete an order.
        </p>
        <p>
          We may also collect basic technical information (such as pages visited and device/browser type) to keep the
          store working correctly and to understand how it&apos;s used.
        </p>
        <p>
          Customers can contact us anytime for questions related to their personal information using the details on
          our <Link to="/contact">Contact page</Link>.
        </p>
        <p>
          Return/refund, shipping, and terms &amp; conditions are covered on our{" "}
          <Link to="/policies">Policies page</Link>.
        </p>
      </div>
    </main>
  );
}
