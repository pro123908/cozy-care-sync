// Turns the courier's own tracking wording into short, plain lines a customer
// can read — "Attempt Made: ICA(INCOMPLETE ADDRESS)" becomes "Delivery
// attempted · The address needs more detail". Pure logic (no React) so it can
// be unit tested; the patterns below were built from the ~280 distinct real
// status strings in production courier_bookings.status_history (PostEx and
// Leopards, Nov 2026). Anything not recognised falls back to the courier's
// original text, so a new courier wording is never hidden or invented.

export type CourierEventKind =
  "progress" | "attempt" | "hold" | "delivered" | "return" | "cancelled";
// What the customer can do about it from the tracking page.
export type CourierEventAction = "address" | "availability" | "contact";

export type CourierEventView = {
  title: string;
  detail?: string;
  kind: CourierEventKind;
  action?: CourierEventAction;
};

// Only codes confirmed against the matching "Departed to <CITY>" events.
// Unknown codes read as "a transit hub" rather than showing a code that means nothing to a customer.
const HUB_CITY: Record<string, string> = {
  KHI: "Karachi",
  LHE: "Lahore",
  RWP: "Rawalpindi",
  SKZ: "Sukkur",
  MUL: "Multan",
  FSD: "Faisalabad",
  HDD: "Hyderabad",
  SWL: "Sahiwal",
  PWR: "Peshawar",
  RYK: "Rahim Yar Khan",
  SKT: "Sialkot",
  GUJ: "Gujranwala",
  GJK: "Gujar Khan",
  HAL: "Hala",
  UET: "Quetta",
  SDQ: "Sadiqabad",
  JLM: "Jhelum",
  VRI: "Vehari",
  NOW: "Nowshera",
  MPK: "Mirpur Khas",
};

const KEEP_UPPER = new Set(["TCP", "DHA", "KHI"]);

function titleCase(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .split(" ")
    .map((w) => (KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w))
    .join(" ")
    .replace(/^Khi\b/, "Karachi");
}

// "KHI MAIN OFFICE" -> "Karachi Main Office"; empty stays empty.
function place(raw: string | undefined): string {
  const clean = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return titleCase(clean.replace(/^KHI\b/i, "Karachi"));
}

function attemptView(code: string, reason: string): CourierEventView {
  const text = `${code} ${reason}`.toLowerCase();
  if (/\bica\b|incomplete|wrong address|invalid address/.test(text)) {
    return {
      title: "Delivery attempted",
      detail: "The address needs more detail. Please send us the full address.",
      kind: "attempt",
      action: "address",
    };
  }
  if (/\bcna\b|not available|unavailable/.test(text)) {
    return {
      title: "Delivery attempted",
      detail: "No one was available to receive it. The courier will try again.",
      kind: "attempt",
      action: "availability",
    };
  }
  if (/\brfd\b|refus/.test(text)) {
    return {
      title: "Delivery attempted",
      detail: "The parcel wasn't accepted at the door. Please contact us if this is a mistake.",
      kind: "attempt",
      action: "contact",
    };
  }
  if (/\bhcr\b|hold/.test(text)) {
    return {
      title: "Delivery on hold",
      detail: "Held at your request. Tell us when you'd like it delivered.",
      kind: "hold",
      action: "availability",
    };
  }
  if (/\bopn\b|open parcel|open shipment/.test(text)) {
    return {
      title: "Delivery attempted",
      detail: "The courier couldn't complete the handover. Please contact us.",
      kind: "attempt",
      action: "contact",
    };
  }
  return {
    title: "Delivery attempted",
    detail: "The courier couldn't complete the delivery. We'll follow up.",
    kind: "attempt",
    action: "contact",
  };
}

export function describeCourierEvent(status: string, statusWithCity?: string): CourierEventView {
  const text = (statusWithCity || status || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  let m: RegExpMatchArray | null;

  // --- delivered ---
  if (/^delivered( to customer)?$/.test(lower)) return { title: "Delivered", kind: "delivered" };

  // --- delivery attempts / holds (PostEx) ---
  if ((m = text.match(/^attempt made:?\s*([A-Za-z]*)\s*(?:\(([^)]*)\))?/i)))
    return attemptView(m[1] ?? "", m[2] ?? "");
  if (lower.startsWith("delivery under review"))
    return {
      title: "Delivery under review",
      detail: "The courier is reviewing this delivery.",
      kind: "hold",
      action: "contact",
    };

  // --- last mile ---
  if (/^en ?route for delivery/.test(lower))
    return { title: "Out for delivery", detail: "A rider is on the way to you.", kind: "progress" };
  if (lower.startsWith("waiting for delivery"))
    return {
      title: "Ready for delivery",
      detail: "At the delivery hub, waiting for a rider.",
      kind: "progress",
    };
  if (lower.startsWith("assigned to courier")) {
    const where = place(text.replace(/^assigned to courier( in)?/i, ""));
    return { title: "Assigned to a delivery rider", detail: where || undefined, kind: "progress" };
  }

  // --- cancelled / returns ---
  if (lower.startsWith("booking cancelled"))
    return { title: "Shipment cancelled", kind: "cancelled" };
  if (lower.startsWith("returned at merchant")) return { title: "Returned to us", kind: "return" };
  if (
    /^(waiting for return|return process initiated|merchant request for return|en route to merchant|return to |return$)/.test(
      lower,
    )
  ) {
    return { title: "Return in progress", kind: "return" };
  }
  if ((m = text.match(/^ready for return\s*-\s*(.*)$/i))) {
    return {
      title: "Return in progress",
      detail: m[1] ? `Reason: ${titleCase(m[1])}` : undefined,
      kind: "return",
    };
  }

  // --- movement through the network ---
  if (lower.startsWith("at wellcaremart"))
    return { title: "Packed and ready for pickup", kind: "progress" };
  if (lower.startsWith("departed to postex"))
    return { title: "Picked up by the courier", kind: "progress" };
  if ((m = text.match(/^shipment picked in\s*(.*)$/i)))
    return {
      title: "Picked up by the courier",
      detail: place(m[1]) || undefined,
      kind: "progress",
    };
  if (/^received at .*warehouse/.test(lower))
    return { title: "Received at the courier's warehouse", kind: "progress" };
  if ((m = text.match(/^arrived at transit hub\s*([A-Za-z]*)/i))) {
    const city = HUB_CITY[(m[1] ?? "").toUpperCase()];
    return {
      title: city ? `Arrived at the ${city} hub` : "Arrived at a transit hub",
      kind: "progress",
    };
  }
  if ((m = text.match(/^arrived at station in\s*(.*)$/i))) {
    const where = place(m[1]);
    return {
      title: where ? `Arrived at ${where}` : "Arrived at a courier station",
      kind: "progress",
    };
  }
  if ((m = text.match(/^(?:departed|dispatched) to(?:\s+(.*))?$/i))) {
    const where = place(m[1]);
    return { title: where ? `On the way to ${where}` : "On the way", kind: "progress" };
  }
  if (lower === "pending") return { title: "Booked with the courier", kind: "progress" };

  // Unknown wording: show the courier's own text (tidied if it's shouting).
  return {
    title: text && text === text.toUpperCase() ? titleCase(text) : text || "Update",
    kind: "progress",
  };
}

// Tracking event times arrive as a plain "YYYY-MM-DD HH:MM:SS" string with no
// timezone. Parsed by hand (not `new Date(raw)`): that space-separated form is
// read as UTC by some browsers and rejected by others.
export function formatEventTime(raw: string): string {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return raw;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
