// Netlify scheduled function — runs every 30 minutes
// Reads upcoming events from JSONBin and fires ntfy notifications for imminent ones

const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;
const NTFY_TOPIC = process.env.NTFY_TOPIC || "tony-jarvis-2026-abc123";
const SITE_URL = "https://sprightly-bublanina-852280.netlify.app";

function formatTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
}

async function sendNtfy(title, message, priority = "default", tags = ["bell"]) {
  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: "POST",
    headers: {
      "Title": title,
      "Priority": priority,
      "Tags": tags.join(","),
      "Click": SITE_URL,
      "Content-Type": "text/plain",
    },
    body: message,
  });
}

exports.handler = async (event) => {
  if (!BIN_ID || !API_KEY) {
    return { statusCode: 500, body: "JSONBin not configured" };
  }

  // Fetch stored schedule
  let data;
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Access-Key": API_KEY },
    });
    const json = await res.json();
    data = json.record;
  } catch (e) {
    console.error("JSONBin fetch failed:", e.message);
    return { statusCode: 500, body: e.message };
  }

  const events = data?.events || [];
  const todos = data?.todos || [];

  // Current time in Pacific
  const now = new Date();
  const pacificOffset = -7; // PDT (summer); change to -8 for PST (winter)
  const pacificNow = new Date(now.getTime() + pacificOffset * 60 * 60 * 1000);
  const todayStr = pacificNow.toISOString().slice(0, 10);
  const nowMins = pacificNow.getUTCHours() * 60 + pacificNow.getUTCMinutes();

  const notifications = [];

  // Check events for today with a time
  for (const ev of events) {
    if (!ev.date || !ev.time || ev.date !== todayStr) continue;
    const [eh, em] = ev.time.split(":").map(Number);
    const evMins = eh * 60 + em;
    const diff = evMins - nowMins;

    // 30-minute warning
    if (diff > 28 && diff <= 32) {
      notifications.push({
        title: `⏰ ${ev.title} in 30 min`,
        message: `${ev.title} at ${formatTime(ev.time)}${ev.notes ? " — " + ev.notes : ""}`,
        priority: "high",
        tags: ["alarm_clock"],
      });
    }
    // On-time alert
    if (diff > -2 && diff <= 2) {
      notifications.push({
        title: `🔔 ${ev.title} now`,
        message: `${ev.title} is starting now.${ev.notes ? " " + ev.notes : ""}`,
        priority: "urgent",
        tags: ["rotating_light"],
      });
    }
  }

  // Check todos due today
  for (const t of todos) {
    if (!t.dueDate || t.dueDate !== todayStr || t.completed) continue;
    if (!t.dueTime) continue;
    const [th, tm] = t.dueTime.split(":").map(Number);
    const tMins = th * 60 + tm;
    const diff = tMins - nowMins;
    if (diff > 28 && diff <= 32) {
      notifications.push({
        title: `📋 Due soon: ${t.title}`,
        message: `"${t.title}" is due at ${formatTime(t.dueTime)}`,
        priority: "high",
        tags: ["pushpin"],
      });
    }
  }

  // Fire all notifications
  await Promise.allSettled(
    notifications.map(n => sendNtfy(n.title, n.message, n.priority, n.tags))
  );

  console.log(`Checked ${events.length} events, ${todos.length} todos. Sent ${notifications.length} notifications.`);
  return {
    statusCode: 200,
    body: JSON.stringify({ checked: events.length + todos.length, sent: notifications.length }),
  };
};
