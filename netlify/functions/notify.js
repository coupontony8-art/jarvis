// Netlify function — sends a push notification via ntfy.sh
// Called from the app for reminders and morning briefing

const NTFY_TOPIC = process.env.NTFY_TOPIC || "tony-jarvis-2026-abc123";

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
    const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST",
      headers: {
        "Title": title,
        "Priority": priority,
        "Tags": tags.join(","),
        "Click": clickUrl,
        "Content-Type": "text/plain",
      },
      body: message,
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        statusCode: response.status,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: err }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};

// ─── SCHEDULED: daily 8pm Pacific reminder ───────────────────────────────────
// Netlify calls this automatically via the schedule in netlify.toml
module.exports.scheduled = async (event) => {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Los_Angeles" });
  const date = now.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Los_Angeles" });

  const messages = [
    `Evening check-in, Tony. ${day}, ${date}. Open Jarvis to see what's on deck.`,
    `Hey. ${day} evening. Your dashboard is waiting. Habits to check off?`,
    `End of day, ${day}. Open Jarvis — log your habits, check tomorrow's schedule.`,
    `${day} evening. The system would like a word. Open Jarvis.`,
    `Daily check-in time. ${date}. Two minutes, then back to your life.`,
  ];
  const message = messages[Math.floor(Math.random() * messages.length)];

  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: "POST",
    headers: {
      "Title": "⚡ Jarvis — Evening Check-in",
      "Priority": "default",
      "Tags": "calendar,bell",
      "Click": "https://sprightly-bublanina-852280.netlify.app",
      "Content-Type": "text/plain",
    },
    body: message,
  });

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
