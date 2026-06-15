import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/map")({
  component: MapPage,
  head: () => ({
    links: [{ rel: "canonical", href: canonicalUrl("/map") }],
    meta: [
      { title: "Store Location - Wellcare Mart" },
      {
        name: "description",
        content: "Find Wellcare Mart's store location and get directions.",
      },
      { property: "og:title", content: "Store Location - Wellcare Mart" },
      {
        property: "og:description",
        content: "Find Wellcare Mart's store location and get directions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MapPage() {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 70px" }}>
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
        Our Location
      </h1>
      <p style={{ margin: "8px 0 18px", color: "var(--ink-4)", fontSize: 14 }}>
        Visit us or use map directions for pickup and support.
      </p>

      <section
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <iframe
          title="Wellcare Mart location map"
          src="https://maps.google.com/maps?q=Lahore%20Pakistan&t=&z=13&ie=UTF8&iwloc=&output=embed"
          width="100%"
          height="420"
          style={{ border: 0, display: "block" }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </section>

      <div style={{ marginTop: 14, color: "var(--ink-3)", fontSize: 14, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Wellcare Mart</div>
        <div>Lahore, Pakistan</div>
        <a
          href="https://www.google.com/maps"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--ink)", fontWeight: 700, textDecoration: "none" }}
        >
          Open in Google Maps
        </a>
      </div>
    </main>
  );
}
