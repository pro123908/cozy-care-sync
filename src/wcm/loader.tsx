type WellcareLoaderProps = {
  label?: string;
  hint?: string;
  compact?: boolean;
  minHeight?: number | string;
};

type WellcareInlineLoaderProps = {
  label?: string;
  size?: number;
};

// The Wellcare Mart icon, grey at first and filling with its real colours from
// the bottom up, over and over (see .wcm-logo-fill in styles.css). logo-mark.webp
// is the W / leaf / cross icon cut from the real logo (aspect 119 x 132).
const LOGO_ASPECT = 119 / 132;

export function WellcareLoader({
  label = "Loading",
  hint = "Please wait a moment",
  compact = false,
  minHeight,
}: WellcareLoaderProps) {
  const logoHeight = compact ? 40 : 64;
  const logoWidth = Math.round(logoHeight * LOGO_ASPECT);
  const resolvedMinHeight = minHeight ?? (compact ? "auto" : "clamp(120px, 22vh, 200px)");
  // The "..." is animated, so drop any the caller already typed.
  const text = label.replace(/[.\u2026\s]+$/, "");

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: resolvedMinHeight,
        padding: compact ? "8px 0" : "20px 12px",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: compact ? 12 : 16,
          color: "var(--ink-3)",
        }}
      >
        <div
          aria-hidden="true"
          className="wcm-logo-loader"
          style={{ width: logoWidth, height: logoHeight }}
        >
          <img
            className="wcm-logo-base"
            src="/logo-mark.webp"
            alt=""
            width={logoWidth}
            height={logoHeight}
            decoding="async"
          />
          <img
            className="wcm-logo-fill"
            src="/logo-mark.webp"
            alt=""
            width={logoWidth}
            height={logoHeight}
            decoding="async"
          />
        </div>

        <div style={{ display: "grid", gap: 3 }}>
          <div
            className="wcm-loader-dots"
            style={{ fontSize: compact ? 13 : 15, fontWeight: 700, color: "var(--ink-2)" }}
          >
            {text}
          </div>
          {!compact && (
            <div style={{ fontSize: 12, color: "var(--ink-4)", letterSpacing: 0.2 }}>{hint}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WellcareInlineLoader({
  label = "Please wait...",
  size = 14,
}: WellcareInlineLoaderProps) {
  return (
    <span
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="2"
        />
        <path
          d="M12 3a9 9 0 0 1 9 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 12 12"
            to="360 12 12"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
      <span>{label}</span>
    </span>
  );
}
