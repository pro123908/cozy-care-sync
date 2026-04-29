import React, { useCallback, useState } from "react";
import { Icons } from "./icons";
import type { Product } from "./data";

export function ProductImage({ product }: { product: Product }) {
  const palettes: Record<string, [string, string, string]> = {
    emerald: ["var(--soft-green)","#d1fae5","#16a34a"],
    sky:     ["#eff6ff","var(--pill-info-bg)","#2563eb"],
    rose:    ["#fff1f2","var(--pill-rose-bg)","#e11d48"],
    amber:   ["#fffbeb","var(--pill-warn-bg)","#b45309"],
    slate:   ["var(--chip-2)","var(--pill-slate-bg)","var(--pill-slate-fg)"],
  };
  const [bg, mid, ink] = palettes[product.swatch] || palettes.emerald;
  const initials = product.name.split(" ").filter(Boolean).slice(0,2).map(w => w[0]).join("").toUpperCase();
  return (
    <div style={{
      position:"relative", width:"100%", aspectRatio:"1/1", overflow:"hidden",
      borderRadius: 12, background:`radial-gradient(120% 100% at 20% 0%, ${bg} 0%, ${mid} 70%, ${bg} 100%)`,
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <svg viewBox="0 0 120 120" width="78%" height="78%" aria-hidden="true">
        <ProductSilhouette cat={product.cat} ink={ink} />
        <text x="60" y="115" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="6" fill={ink} opacity="0.55">
          {product.brand.toUpperCase()}
        </text>
      </svg>
      <div style={{
        position:"absolute", top:10, left:10, padding:"3px 8px", borderRadius:99,
        background:"rgba(255,255,255,0.85)", fontSize:10, fontWeight:700, color:ink,
        letterSpacing:0.5, textTransform:"uppercase", backdropFilter:"blur(4px)"
      }}>{initials}</div>
    </div>
  );
}

export function ProductSilhouette({ cat, ink }: { cat: string; ink: string }) {
  const stroke = { stroke: ink, strokeWidth: 2, fill:"#ffffff", strokeLinecap:"round" as const, strokeLinejoin:"round" as const };
  switch (cat) {
    case "monitoring":
      return (<g {...stroke}>
        <rect x="28" y="32" width="64" height="44" rx="6"/>
        <rect x="36" y="40" width="48" height="22" rx="3" fill={ink} opacity="0.08"/>
        <path d="M40 52 l6 0 l3 -6 l4 12 l4 -8 l3 4 l8 0" stroke={ink} fill="none"/>
        <circle cx="44" cy="68" r="2" fill={ink}/>
        <circle cx="60" cy="68" r="2" fill={ink}/>
        <circle cx="76" cy="68" r="2" fill={ink}/>
      </g>);
    case "respiratory":
      return (<g {...stroke}>
        <ellipse cx="60" cy="62" rx="22" ry="14"/>
        <path d="M82 62 q10 -2 12 -10"/>
        <path d="M38 62 q-10 -2 -12 -10"/>
        <path d="M60 48 v-12"/>
        <rect x="55" y="28" width="10" height="10" rx="2" fill={ink} opacity="0.15"/>
      </g>);
    case "mobility":
      return (<g {...stroke}>
        <circle cx="42" cy="78" r="10"/>
        <circle cx="82" cy="78" r="10"/>
        <path d="M30 50 h50 l-6 22 h-32 z"/>
        <path d="M58 50 v-18 h12"/>
      </g>);
    case "patient-care":
      return (<g {...stroke}>
        <rect x="22" y="48" width="76" height="22" rx="4"/>
        <path d="M22 56 h76"/>
        <rect x="30" y="36" width="20" height="14" rx="3" fill={ink} opacity="0.12"/>
        <path d="M34 78 v8 M86 78 v8"/>
      </g>);
    case "therapy":
      return (<g {...stroke}>
        <rect x="28" y="36" width="64" height="40" rx="10"/>
        <path d="M40 56 q8 -10 16 0 t16 0" stroke={ink} fill="none"/>
        <circle cx="42" cy="46" r="2" fill={ink}/>
        <circle cx="78" cy="46" r="2" fill={ink}/>
      </g>);
    case "consumables":
      return (<g {...stroke}>
        <rect x="32" y="30" width="56" height="60" rx="6"/>
        <path d="M32 46 h56 M32 62 h56 M32 78 h56" stroke={ink} opacity="0.4"/>
        <rect x="44" y="20" width="32" height="14" rx="3" fill={ink} opacity="0.1"/>
      </g>);
    default:
      return <rect x="30" y="30" width="60" height="60" rx="8" {...stroke}/>;
  }
}

export const Stars = ({ value = 4.5, size = 13, showNum = true }: { value?: number; size?: number; showNum?: boolean }) => (
  <span style={{ display:"inline-flex", alignItems:"center", gap:4, color:"#f59e0b" }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="12,3 14.7,9 21,9.7 16.2,14 17.6,20.5 12,17.3 6.4,20.5 7.8,14 3,9.7 9.3,9"/></svg>
    {showNum && <span style={{ color:"var(--ink-2)", fontWeight:600, fontSize:size }}>{value.toFixed(1)}</span>}
  </span>
);

export const Pill = ({ children, tone="green" }: { children: React.ReactNode; tone?: string }) => {
  const tones: Record<string, { bg: string; fg: string }> = {
    green: { bg:"var(--pill-success-bg)", fg:"var(--pill-success-fg)" },
    blue:  { bg:"var(--pill-info-bg)", fg:"var(--pill-info-fg)" },
    amber: { bg:"var(--pill-warn-bg)", fg:"var(--pill-warn-fg)" },
    rose:  { bg:"var(--pill-rose-bg)", fg:"var(--pill-rose-fg)" },
    slate: { bg:"var(--pill-slate-bg)", fg:"var(--pill-slate-fg)" },
  };
  const t = tones[tone] || tones.green;
  return <span style={{
    display:"inline-flex", alignItems:"center", gap:4, padding:"3px 8px",
    background: t.bg, color: t.fg, borderRadius: 99, fontSize: 11, fontWeight:700, letterSpacing:0.2
  }}>{children}</span>;
};

type BtnProps = {
  children?: React.ReactNode; variant?: string; size?: "sm" | "md" | "lg";
  onClick?: (e: React.MouseEvent) => void; disabled?: boolean;
  style?: React.CSSProperties; full?: boolean; type?: "button" | "submit";
  icon?: React.ReactNode; iconRight?: React.ReactNode;
  ["aria-label"]?: string;
};
export const Btn = ({ children, variant="primary", size="md", onClick, disabled, style, full, type="button", icon, iconRight, ...rest }: BtnProps) => {
  const sizes: Record<string, { padding: string; fontSize: number; radius: number }> = {
    sm: { padding:"7px 12px", fontSize:13, radius:9 },
    md: { padding:"10px 16px", fontSize:14, radius:11 },
    lg: { padding:"14px 20px", fontSize:15, radius:13 },
  };
  const s = sizes[size];
  const variants: Record<string, React.CSSProperties> = {
    primary: { background:"var(--grad)", color:"#fff", border:"none", boxShadow:"0 6px 16px -6px rgba(37,99,235,.45), 0 2px 4px rgba(22,163,74,.18)" },
    solid:   { background:"var(--ink)", color:"#fff", border:"none" },
    ghost:   { background:"transparent", color:"var(--ink-2)", border:"1px solid transparent" },
    soft:    { background:"var(--chip)", color:"var(--ink-2)", border:"1px solid transparent" },
    outline: { background:"var(--card)", color:"var(--ink)", border:"1px solid var(--line)" },
    danger:  { background:"var(--card)", color:"var(--pill-rose-fg)", border:"1px solid var(--pill-rose-bg)" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} {...rest}
      style={{
        ...variants[variant], ...style, padding:s.padding, fontSize:s.fontSize, borderRadius:s.radius,
        fontWeight:700, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1, transition:"transform .06s ease, box-shadow .15s ease, opacity .15s",
        display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8, width: full ? "100%" : undefined,
        whiteSpace:"nowrap"
      }}
      onMouseDown={e=>(e.currentTarget.style.transform="translateY(1px)")}
      onMouseUp={e=>(e.currentTarget.style.transform="translateY(0)")}
      onMouseLeave={e=>(e.currentTarget.style.transform="translateY(0)")}
    >
      {icon}{children}{iconRight}
    </button>
  );
};

type TextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string };
export const TextField = ({ label, hint, error, ...rest }: TextFieldProps) => (
  <label style={{ display:"flex", flexDirection:"column", gap:6 }}>
    {label && <span style={{ fontSize:12, fontWeight:700, color:"var(--ink-3)", letterSpacing:0.2 }}>{label}</span>}
    <input {...rest} style={{
      padding:"11px 14px", borderRadius:11, border:`1px solid ${error?"var(--rose,#e11d48)":"var(--line)"}`,
      background:"var(--card)", fontFamily:"inherit", fontSize:14, outline:"none",
      transition:"border-color .15s, box-shadow .15s",
      boxShadow: error ? "0 0 0 3px var(--pill-rose-bg)" : "none",
      ...rest.style
    }}
    onFocus={e=>{ e.currentTarget.style.borderColor="#93c5fd"; e.currentTarget.style.boxShadow="0 0 0 3px var(--pill-info-bg)"; rest.onFocus?.(e); }}
    onBlur ={e=>{ e.currentTarget.style.borderColor= error?"#fda4af":"var(--line)"; e.currentTarget.style.boxShadow= error?"0 0 0 3px var(--pill-rose-bg)":"none"; rest.onBlur?.(e); }}
    />
    {hint && !error && <span style={{ fontSize:11.5, color:"var(--ink-4)" }}>{hint}</span>}
    {error && <span style={{ fontSize:11.5, color:"var(--pill-rose-fg)" }}>{error}</span>}
  </label>
);

export const Section = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background:"var(--card)", border:"1px solid var(--line)", borderRadius:"var(--radius-lg)", boxShadow:"var(--shadow-sm)", ...style }}>{children}</div>
);

type Toast = { id: string; msg: string; tone: string; icon?: React.ReactNode };
export function useToasts(){
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, opts: { tone?: string; icon?: React.ReactNode; ms?: number } = {})=>{
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, tone: opts.tone || "green", icon: opts.icon }]);
    setTimeout(()=> setToasts(t => t.filter(x => x.id !== id)), opts.ms || 2400);
  },[]);
  const Toaster = () => (
    <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", display:"flex", flexDirection:"column", gap:8, zIndex:120, pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display:"flex", alignItems:"center", gap:10, padding:"10px 16px", borderRadius:99,
          background:"var(--ink)", color:"#fff", boxShadow:"var(--shadow-lg)", fontSize:13, fontWeight:600,
          animation:"toastIn .25s ease both"
        }}>
          <span style={{ color: t.tone==="green" ? "#34d399" : "#93c5fd", display:"inline-flex" }}>
            {t.icon || Icons.check}
          </span>
          {t.msg}
        </div>
      ))}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
  return { push, Toaster };
}

export const Row = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", color:"var(--ink-2)" }}>
    <span style={{ color:"var(--ink-3)" }}>{label}</span>
    <span style={{ fontWeight:700 }}>{value}</span>
  </div>
);
