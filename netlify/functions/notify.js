// Netlify function — sends a push notification via ntfy.sh
// Called from the app (URL-callable). Must NOT have a schedule: scheduled
// functions can't be invoked by URL. The 8pm check-in lives in evening-checkin.js.

const NTFY_TOPIC = process.env.NTFY_TOPIC || "tony-jarvis-2026-abc123";
// ntfy via JSON publishing: titles/messages can carry emoji. (Header-based
// publishing crashed fetch, since HTTP headers can't hold non-Latin characters.)
const NTFY_PRIORITY = { min: 1, low: 2, default: 3, high: 4, urgent: 5 };
async function sendNtfy({ title, message, priority = "default", tags = ["bell"], click = "https://sprightly-bublanina-852280.netlify.app" }) {
  const res = await fetch("https://ntfy.sh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: NTFY_TOPIC, title, message, priority: NTFY_PRIORITY[priority] || 3, tags, click }),
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}: ${await res.text()}`);
  return res;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    body = { title: "Jarvis", message: "You have a reminder." };
  }

  const title = body.title || "Jarvis";
  const message = body.message || "Tap to open your dashboard.";
  const priority = body.priority || "default"; // min, low, default, high, urgent
  const tags = body.tags || ["bell"];
  const clickUrl = body.url || "https://sprightly-bublanina-852280.netlify.app";

  try {
    await sendNtfy({ title, message, priority, tags, click: clickUrl });
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, topic: NTFY_TOPIC }),
    };
  } catch (e) {
    console.error("notify failed:", e.message);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
