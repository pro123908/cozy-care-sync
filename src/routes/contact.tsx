import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalUrl } from "@/lib/seo";
import { CONTACT } from "@/lib/agentReadiness";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/contact") }],
    meta: [
      { title: "Contact Wellcare Mart" },
      {
        name: "description",
        content: "Get in touch with Wellcare Mart for order support, product questions, or general inquiries.",
      },
      { property: "og:title", content: "Contact Wellcare Mart" },
      {
        property: "og:description",
        content: "Get in touch with Wellcare Mart for order support, product questions, or general inquiries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ContactPage() {
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
        Contact Us
      </h1>
      <p style={{ margin: "8px 0 22px", color: "var(--ink-4)", fontSize: 14, lineHeight: 1.6 }}>
        Have a question about an order, a product, or delivery? Reach our team directly using any of the channels
        below. We respond to calls, WhatsApp messages, and emails throughout the week to help with orders, product
        questions, and delivery updates.
      </p>

      <section
        style={{
          display: "grid",
          gap: 14,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: 20,
          color: "var(--ink-3)",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>Phone &amp; WhatsApp</div>
          <a href={`tel:${CONTACT.telephone}`} style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600 }}>
            {CONTACT.telephone}
          </a>
        </div>
        <div>
          <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>Email</div>
          <a href={`mailto:${CONTACT.email}`} style={{ color: "var(--ink)", textDecoration: "none", fontWeight: 600 }}>
            {CONTACT.email}
          </a>
        </div>
        <div>
          <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>Address</div>
          <div>{CONTACT.name}</div>
          <div>{CONTACT.streetAddress}</div>
          <div>
            {CONTACT.addressLocality}, {CONTACT.addressRegion}, Pakistan
          </div>
        </div>
      </section>

      <p style={{ marginTop: 18, color: "var(--ink-4)", fontSize: 13 }}>
        Looking for our store location instead? Visit the <Link to="/map">Map page</Link>. For returns, shipping, and
        other policies, see <Link to="/policies">Policies</Link>.
      </p>
    </main>
  );
}
