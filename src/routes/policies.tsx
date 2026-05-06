import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Icons } from "@/wcm/icons";

export const Route = createFileRoute("/policies")({
  component: PoliciesPage,
});

const sections = [
  { id: "privacy", label: "Privacy Policy", icon: "🔒" },
  { id: "returns", label: "Returns & Refunds", icon: "↩️" },
  { id: "shipping", label: "Shipping Policy", icon: "🚚" },
  { id: "terms", label: "Terms & Conditions", icon: "📋" },
];

function PoliciesPage() {
  const navigate = useNavigate();
  const { hash } = window.location;

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [hash]);

  const cardStyle: React.CSSProperties = {
    background: "var(--card)",
    borderRadius: 20,
    border: "1px solid var(--line)",
    padding: "28px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  const h2Style: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: -0.3,
    color: "var(--ink)",
    marginBottom: 4,
  };

  const pStyle: React.CSSProperties = {
    fontSize: 14,
    color: "var(--ink-2)",
    lineHeight: 1.75,
    margin: 0,
  };

  const h3Style: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--ink)",
    marginTop: 8,
    marginBottom: 2,
  };

  const listStyle: React.CSSProperties = {
    fontSize: 14,
    color: "var(--ink-2)",
    lineHeight: 1.75,
    paddingLeft: 20,
    margin: 0,
  };

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "40px auto",
        padding: "0 20px 100px",
        display: "flex",
        flexDirection: "column",
        gap: 32,
      }}
    >
      {/* Back */}
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

      {/* Title */}
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Policies</div>
        <div style={{ fontSize: 14, color: "var(--ink-4)", marginTop: 6 }}>
          Last updated: May 2026 · Wellcare Mart
        </div>
      </div>

      {/* Quick nav chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              background: "var(--card)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-2)",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <span>{s.icon}</span>
            {s.label}
          </a>
        ))}
      </div>

      {/* ── Privacy ── */}
      <div id="privacy" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>🔒</span>
          <div style={h2Style}>Privacy Policy</div>
        </div>
        <p style={pStyle}>
          Wellcare Mart respects your privacy. We collect basic customer information such as name,
          phone number, delivery address, and order details only for processing orders, deliveries,
          customer support, and service improvement.
        </p>
        <p style={pStyle}>
          We do not sell or misuse customer data. Customer information may only be shared with
          delivery partners or service providers when required to complete an order.
        </p>
        <p style={pStyle}>
          Customers can contact us anytime for questions related to their personal information.
        </p>
      </div>

      {/* ── Returns & Refunds ── */}
      <div id="returns" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>↩️</span>
          <div style={h2Style}>Return / Refund Policy</div>
        </div>
        <p style={{ ...pStyle, color: "var(--ink-4)", fontSize: 13 }}>
          At Wellcare Mart, we aim to provide reliable medical and healthcare products at affordable
          prices.
        </p>
        <div>
          <div style={h3Style}>Returns & exchanges are accepted only if:</div>
          <ul style={listStyle}>
            <li>The product is damaged, defective, or incorrect at the time of delivery.</li>
            <li>
              The issue is reported within <strong>24 hours</strong> of receiving the product.
            </li>
            <li>The product is unused, unopened, and in its original packaging.</li>
          </ul>
        </div>
        <div>
          <div style={h3Style}>Non-Returnable Items</div>
          <p style={pStyle}>
            Due to the nature of medical and healthcare products, some items such as masks, gloves,
            diapers, hygiene products, disposable items, and personal-use medical products may not
            be returnable once opened or used.
          </p>
        </div>
        <div>
          <div style={h3Style}>Processing</div>
          <p style={pStyle}>
            Refunds, replacements, or exchanges will be processed after verification by our team.
          </p>
        </div>
      </div>

      {/* ── Shipping ── */}
      <div id="shipping" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>🚚</span>
          <div style={h2Style}>Shipping / Service Policy</div>
        </div>
        <p style={{ ...pStyle, color: "var(--ink-4)", fontSize: 13 }}>
          Wellcare Mart provides doorstep delivery of medical and healthcare products.
        </p>
        <p style={pStyle}>
          Delivery time may vary based on product availability, customer location, and courier
          service. We try our best to deliver orders as quickly as possible.
        </p>
        <p style={pStyle}>
          Customers will be contacted to confirm their order before dispatch. Delivery charges may
          apply depending on location and order size.
        </p>
        <p style={pStyle}>
          For urgent medical product requirements, customers are encouraged to contact us directly
          before placing an order.
        </p>
      </div>

      {/* ── Terms ── */}
      <div id="terms" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>📋</span>
          <div style={h2Style}>Terms & Conditions</div>
        </div>
        <p style={{ ...pStyle, color: "var(--ink-4)", fontSize: 13 }}>
          By using the Wellcare Mart website or placing an order, customers agree to the following
          terms:
        </p>
        <ul style={listStyle}>
          <li>Product prices and availability may change without prior notice.</li>
          <li>Product images are for reference and may slightly differ from the actual product.</li>
          <li>Customers are responsible for providing accurate contact and delivery details.</li>
          <li>
            Wellcare Mart reserves the right to cancel any order due to stock unavailability,
            pricing errors, or delivery limitations.
          </li>
          <li>
            Medical equipment and healthcare products should be used according to manufacturer
            instructions or professional guidance.
          </li>
          <li>Wellcare Mart is not responsible for misuse of any product after delivery.</li>
        </ul>
      </div>

      {/* Contact strip */}
      <div
        id="contact"
        style={{
          background:
            "linear-gradient(140deg, rgba(22,163,74,0.12) 0%, rgba(22,163,74,0.04) 100%), var(--card)",
          borderRadius: 18,
          border: "1px solid var(--line)",
          padding: "22px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>Contact Us</div>
        <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.9 }}>
          <div>
            <strong>Wellcare Mart</strong>
          </div>
          <div>📍 40 Darul Aman, Road 4, Block 3, Delhi Mercantile Society</div>
          <div>
            📞{" "}
            <a
              href="tel:+923291557509"
              style={{ color: "var(--ink-2)", textDecoration: "none", fontWeight: 600 }}
            >
              +92 329 1557509
            </a>
          </div>
          <div>
            ✉️{" "}
            <a
              href="mailto:danialansari998@gmail.com"
              style={{ color: "var(--ink-2)", textDecoration: "none", fontWeight: 600 }}
            >
              danialansari998@gmail.com
            </a>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          <a
            href="mailto:danialansari998@gmail.com"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 10,
              background: "var(--card)",
              border: "1px solid var(--line)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-2)",
              textDecoration: "none",
            }}
          >
            <svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            Email us
          </a>
          <a
            href="https://wa.me/923291557509"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 10,
              background: "var(--card)",
              border: "1px solid var(--line)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-2)",
              textDecoration: "none",
            }}
          >
            {Icons.phone} WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
