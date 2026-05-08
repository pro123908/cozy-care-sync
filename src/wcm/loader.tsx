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

export function WellcareLoader({
  label = "Loading",
  hint = "Please wait a moment",
  compact = false,
  minHeight,
}: WellcareLoaderProps) {
  const orbSize = compact ? 34 : 56;
  const resolvedMinHeight = minHeight ?? (compact ? "auto" : "clamp(120px, 22vh, 200px)");

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
          gap: compact ? 10 : 14,
          color: "var(--ink-3)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: orbSize,
            height: orbSize,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background:
              "radial-gradient(120% 120% at 15% 0%, rgba(255,255,255,.9) 0%, transparent 45%), var(--grad-soft)",
            border: "1px solid var(--line)",
            boxShadow: "0 10px 28px -16px rgba(2,6,23,.38)",
          }}
        >
          <svg width={compact ? 22 : 30} height={compact ? 22 : 30} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="var(--line-2)" strokeWidth="2.2" />
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="var(--blue-600)"
              strokeWidth="2.6"
              strokeDasharray="40 30"
              strokeLinecap="round"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 12 12"
                to="360 12 12"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
            <path d="M12 7v10M7 12h10" stroke="var(--green-600)" strokeWidth="1.9" />
          </svg>
        </div>

        <div style={{ display: "grid", gap: 3 }}>
          <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: "var(--ink-2)" }}>
            {label}
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
