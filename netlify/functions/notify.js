// Netlify function — sends a push notification via ntfy.sh
// Called from the app for reminders and morning briefing

const NTFY_TOPIC = process.env.NTFY_TOPIC || "tony-jarvis-2026-abc123";
const EVENING_HOUR = 20; // 8pm Pacific

// Pacific date/time parts — DST-safe (Netlify cron runs in UTC)
function pacificNow(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
    }).formatToParts(d).map(x => [x.type, x.value])
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday),
  };
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

  // Netlify's scheduler calls this same handler with { next_run } in the body.
  // That's the evening check-in, not an app notification.
  if (body && body.next_run) {
    return eveningCheckIn();
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
        body: JSON.stringify({ error: err, topic: NTFY_TOPIC }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, topic: NTFY_TOPIC }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};

// ─── SCHEDULED: daily 8pm Pacific check-in ───────────────────────────────────
// Cron fires at 03:00 and 04:00 UTC; only the run that lands at 8pm Pacific sends.
async function eveningCheckIn(now = new Date()) {
  if (pacificNow(now).hour !== EVENING_HOUR) {
    return { statusCode: 200, body: JSON.stringify({ skipped: "not 8pm Pacific" }) };
  }
  const day = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Los_Angeles" });
  const date = now.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Los_Angeles" });

  const messages = [
    `Evening check-in, Tony. ${day}, ${date}. The habits are waiting. They're always waiting.`,
    `${day} evening. Your dashboard has been staring at the door all day. Open Jarvis.`,
    `End of day, ${day}. Log your habits before they file a complaint.`,
    `${day} evening. The system would like a word. Several words. Open Jarvis.`,
    `Daily check-in. ${date}. Two minutes, then you may return to your life. Probably.`,
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
}

exports._test = { pacificNow, eveningCheckIn };
