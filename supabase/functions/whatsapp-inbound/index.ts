import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Inbound webhook for the AUTOMATION number (+92 339 0104375) on WhatsApp
// Cloud API. That number only ever sends order confirmations — nobody watches
// it. But customers naturally hit "reply" on a WhatsApp message rather than
// tapping a button, so without this their message would vanish into a webhook
// nobody reads and they'd think they were being ignored (worse than the manual
// flow this replaces).
//
// So: any inbound message gets a one-off auto-reply pointing at the real
// support number, which stays on the WhatsApp Business app where the team does
// manual chat + voice notes.
//
// Free-form text is allowed here (no template needed) because the customer
// messaging us opens a 24-hour customer-service window.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
const WHATSAPP_GRAPH_VERSION = Deno.env.get("WHATSAPP_GRAPH_VERSION") || "v21.0";
// Meta echoes this back during webhook setup (GET) to prove we own the endpoint.
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") || "";
const SUPPORT_NUMBER = Deno.env.get("WHATSAPP_SUPPORT_NUMBER") || "+92 329 1557509";

// Don't re-send the same redirect to someone mid-conversation.
const AUTO_REPLY_COOLDOWN_HOURS = 6;

const replyText = () =>
  `Thanks for your message! 🙏\n\nThis number is automated and isn't monitored, so we won't see replies here.\n\nFor any questions about your order, please WhatsApp us at ${SUPPORT_NUMBER} — our team will help you right away.`;

async function sendText(to: string, body: string): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body, preview_url: false },
      }),
    },
  );
  if (!res.ok) {
    console.error("[whatsapp-inbound] send failed", {
      status: res.status,
      body: await res.text().catch(() => ""),
    });
  }
}

// Returns true if this sender is outside the cooldown (i.e. we should reply).
async function shouldReply(phone: string): Promise<boolean> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("whatsapp_auto_reply_log")
    .select("last_replied_at")
    .eq("phone", phone)
    .maybeSingle();

  // On a lookup error, err toward replying — a duplicate redirect is a much
  // smaller failure than silently ignoring a customer.
  if (error) {
    console.error("[whatsapp-inbound] cooldown lookup failed", error.message);
    return true;
  }

  if (data?.last_replied_at) {
    const elapsedHours = (Date.now() - new Date(data.last_replied_at).getTime()) / 3_600_000;
    if (elapsedHours < AUTO_REPLY_COOLDOWN_HOURS) return false;
  }

  await supabase
    .from("whatsapp_auto_reply_log")
    .upsert({ phone, last_replied_at: new Date().toISOString() }, { onConflict: "phone" });

  return true;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ── Webhook verification handshake (Meta sends this once, on setup) ──
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && WHATSAPP_WEBHOOK_VERIFY_TOKEN && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Meta retries (and eventually disables) a webhook that doesn't 200 quickly,
  // so every path below returns 200 — failures are logged, never surfaced.
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.info("[whatsapp-inbound] Cloud API not configured - ignoring");
    return new Response("ok", { status: 200 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  try {
    const entries = (payload.entry as Array<Record<string, unknown>>) || [];
    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) || [];
      for (const change of changes) {
        const value = (change.value as Record<string, unknown>) || {};
        // `statuses` (delivery/read receipts for our own sends) also arrive here
        // — only real inbound messages should trigger a reply.
        const messages = (value.messages as Array<Record<string, unknown>>) || [];
        for (const message of messages) {
          const from = typeof message.from === "string" ? message.from : "";
          if (!from) continue;
          if (await shouldReply(from)) {
            await sendText(from, replyText());
          }
        }
      }
    }
  } catch (err) {
    console.error("[whatsapp-inbound] handler threw", err);
  }

  return new Response("ok", { status: 200 });
});
