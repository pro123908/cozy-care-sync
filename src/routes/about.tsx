import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [{ title: "About Wellcare Mart" }],
  }),
});

function AboutPage() {
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
        About Wellcare Mart
      </h1>
      <p style={{ margin: "10px 0 18px", color: "var(--ink-3)", fontSize: 15, lineHeight: 1.7 }}>
        Wellcare Mart is focused on making home healthcare products easier to discover, compare, and
        order. We help families, caregivers, and clinics find trusted solutions for daily
        monitoring, mobility, respiratory care, and recovery support.
      </p>

      <section
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "16px 18px",
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>
          What we do
        </h2>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.7 }}>
          We curate practical medical and wellness essentials, keep availability updated, and
          provide a smooth checkout and order tracking experience.
        </p>
      </section>

      <section
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "16px 18px",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>
          Our promise
        </h2>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.7 }}>
          Reliable products, transparent information, and responsive customer support.
        </p>
      </section>
    </main>
  );
}
