import React from "react";

const Ic = ({
  d,
  size = 20,
  stroke = 1.8,
  fill = "none",
}: {
  d: React.ReactNode;
  size?: number;
  stroke?: number;
  fill?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);

export const Icons = {
  search: (
    <Ic
      d={
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </>
      }
    />
  ),
  cart: (
    <Ic
      d={
        <>
          <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21 8H6" />
          <circle cx="10" cy="20" r="1.4" />
          <circle cx="18" cy="20" r="1.4" />
        </>
      }
    />
  ),
  user: (
    <Ic
      d={
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
        </>
      }
    />
  ),
  pkg: (
    <Ic
      d={
        <>
          <path d="M21 7 12 3 3 7l9 4 9-4Z" />
          <path d="M3 7v10l9 4 9-4V7" />
          <path d="M12 11v10" />
        </>
      }
    />
  ),
  home: (
    <Ic
      d={
        <>
          <path d="M3 11 12 4l9 7" />
          <path d="M5 10v10h14V10" />
        </>
      }
    />
  ),
  star: (
    <Ic
      d={
        <polygon points="12,3 14.7,9 21,9.7 16.2,14 17.6,20.5 12,17.3 6.4,20.5 7.8,14 3,9.7 9.3,9" />
      }
    />
  ),
  starF: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="12,3 14.7,9 21,9.7 16.2,14 17.6,20.5 12,17.3 6.4,20.5 7.8,14 3,9.7 9.3,9" />
    </svg>
  ),
  plus: (
    <Ic
      d={
        <>
          <path d="M12 5v14M5 12h14" />
        </>
      }
    />
  ),
  minus: <Ic d={<path d="M5 12h14" />} />,
  trash: (
    <Ic
      d={
        <>
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
        </>
      }
    />
  ),
  truck: (
    <Ic
      d={
        <>
          <rect x="2" y="7" width="12" height="10" rx="1.5" />
          <path d="M14 10h4l3 3v4h-7" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="17" cy="18" r="1.6" />
        </>
      }
    />
  ),
  shield: (
    <Ic
      d={
        <>
          <path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      }
    />
  ),
  bolt: <Ic d={<polygon points="13,2 4,14 11,14 9,22 20,9 13,9" />} />,
  heart: <Ic d={<path d="M12 21s-7-4.5-9-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 5.5-9 10-9 10Z" />} />,
  chev: <Ic d={<path d="m9 6 6 6-6 6" />} />,
  chevD: <Ic d={<path d="m6 9 6 6 6-6" />} />,
  chevL: <Ic d={<path d="m15 6-6 6 6 6" />} />,
  close: (
    <Ic
      d={
        <>
          <path d="M6 6l12 12M18 6 6 18" />
        </>
      }
    />
  ),
  check: <Ic d={<path d="m5 12 4 4 10-10" />} stroke={2.4} />,
  filter: (
    <Ic
      d={
        <>
          <path d="M3 5h18" />
          <path d="M6 12h12" />
          <path d="M10 19h4" />
        </>
      }
    />
  ),
  pin: (
    <Ic
      d={
        <>
          <path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12Z" />
          <circle cx="12" cy="10" r="2.5" />
        </>
      }
    />
  ),
  phone: (
    <Ic
      d={
        <path d="M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
      }
    />
  ),
  copy: (
    <Ic
      d={
        <>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </>
      }
    />
  ),
  card: (
    <Ic
      d={
        <>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 11h18" />
        </>
      }
    />
  ),
  cash: (
    <Ic
      d={
        <>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="12" cy="12" r="3" />
        </>
      }
    />
  ),
  filePlus: (
    <Ic
      d={
        <>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <path d="M14 3v5h5" />
          <path d="M12 11v6M9 14h6" />
        </>
      }
    />
  ),
  dot: (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <circle cx="4" cy="4" r="4" fill="currentColor" />
    </svg>
  ),
  bell: (
    <Ic
      d={
        <>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </>
      }
    />
  ),
  refresh: (
    <Ic
      d={
        <>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 4v4h-4" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 20v-4h4" />
        </>
      }
    />
  ),
  sparkle: (
    <Ic
      d={
        <>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
        </>
      }
    />
  ),
  percent: (
    <Ic
      d={
        <>
          <circle cx="8.5" cy="8.5" r="2.5" />
          <circle cx="15.5" cy="15.5" r="2.5" />
          <path d="M18 6 6 18" />
        </>
      }
    />
  ),
  facebook: (
    <Ic
      d={
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      }
    />
  ),
  whatsapp: (
    <Ic
      d={
        <>
          <path d="M12 3.5c-4.7 0-8.5 3.8-8.5 8.5 0 1.5.4 2.9 1.2 4.1L3 20l4.1-1.1A8.4 8.4 0 0 0 12 21c4.7 0 8.5-3.8 8.5-8.5S16.7 3.5 12 3.5Z" />
          <path d="M15.3 12.5c-.1-.2-.3-.4-.5-.4-.2 0-.5 0-.8.1-.2.1-.5.2-.7.3-.2.1-.4.1-.7 0a2.6 2.6 0 0 0-1.1-.1c-.4.1-.8.3-1.1.6-.3.2-.5.6-.6 1-.1.4-.1.8.1 1.2.2.4.5.7.9.9.4.2.8.2 1.2.1.3 0 .5-.1.7-.2.2-.1.3-.3.5-.4.1-.1.2-.1.3-.1.2 0 .4.1.6.1.2.1.4.2.6.4.2.2.4.4.5.6.1.2.1.4.1.6s0 .4-.1.6c-.2.4-.5.7-.9.9-.5.2-1.1.3-1.6.2-.5-.1-1-.3-1.4-.6-.4-.3-.8-.7-1-1.1-.2-.4-.4-.8-.4-1.2 0-.4.1-.8.4-1.1.3-.4.7-.8 1.1-1 .4-.2.8-.4 1.3-.4.5 0 .9.1 1.3.4.4.2.7.4.9.7.2.2.3.4.4.6.1.2.1.4.1.6 0 .1 0 .2-.1.3-.1.1-.3.2-.5.2-.2 0-.4 0-.6-.1Z" />
        </>
      }
    />
  ),
};

export const WellcareLogo = ({ size = 36 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="wcg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#16a34a" />
        <stop offset="55%" stopColor="#1a8a52" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="28" fill="url(#wcg)" />
    <path
      d="M32 14a14 14 0 0 0-14 14c0 4 2 8 6 12-4-1-8-3-9-7 0 9 7 16 17 16s17-7 17-16c-1 4-5 6-9 7 4-4 6-8 6-12A14 14 0 0 0 32 14Z"
      fill="rgba(255,255,255,0.18)"
    />
    <g fill="#ffffff">
      <rect x="28" y="20" width="8" height="24" rx="1.5" />
      <rect x="20" y="28" width="24" height="8" rx="1.5" />
    </g>
    <path
      d="M22 32 h4 l2 -4 l3 8 l3 -6 l2 2 h6"
      stroke="#16a34a"
      strokeWidth="1.8"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const WellcareWordmark = ({ height = 28 }: { height?: number }) => (
  <div
    style={{ display: "flex", alignItems: "center", gap: 10, lineHeight: 1, whiteSpace: "nowrap" }}
  >
    <WellcareLogo size={height + 10} />
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontSize: height * 0.72, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1 }}>
        <span
          style={{
            background: "linear-gradient(95deg,#15803d 0%, #0f766e 45%, #2563eb 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Well
        </span>
        <span style={{ color: "#1d4ed8" }}>Care</span>
        <span style={{ color: "#15803d" }}>mart</span>
        <span
          style={{
            marginLeft: 4,
            fontSize: height * 0.34,
            padding: "2px 5px",
            background: "#2563eb",
            color: "#fff",
            borderRadius: 4,
            verticalAlign: "top",
            display: "inline-block",
            transform: "translateY(-2px)",
          }}
        >
          .pk
        </span>
      </div>
      <div
        style={{
          fontSize: height * 0.34,
          color: "var(--ink-4)",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        Your Health, Our Care
      </div>
    </div>
  </div>
);
