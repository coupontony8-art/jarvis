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

// Pacific date, minutes since midnight, and weekday (0=Sun) — DST-safe
function pacificNow(d) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
    }).formatToParts(d).map(p => [p.type, p.value])
  );
  return {
    todayStr: `${parts.year}-${parts.month}-${parts.day}`,
    nowMins: Number(parts.hour) * 60 + Number(parts.minute),
    dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday),
  };
}

// Habit reminder is due on the first run at/after its time (runs are 30 min apart)
function habitReminderDue(h, todayStr, nowMins, dow) {
  if (!h.reminderTime) return false;
  if (h.startDate && todayStr < h.startDate) return false;
  const scheduled = h.frequency === "daily" || (h.daysOfWeek || []).includes(dow);
  if (!scheduled) return false;
  if ((h.doneDates || []).includes(todayStr)) return false;
  const [rh, rm] = h.reminderTime.split(":").map(Number);
  const since = nowMins - (rh * 60 + rm);
  return since >= 0 && since < 30;
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
      headers: { "X-Master-Key": API_KEY },
    });
    const json = await res.json();
    data = json.record;
  } catch (e) {
    console.error("JSONBin fetch failed:", e.message);
    return { statusCode: 500, body: e.message };
  }

  const events = data?.events || [];
  const todos = data?.todos || [];

  // Current time in Pacific (handles daylight saving automatically)
  const { todayStr, nowMins, dow } = pacificNow(new Date());

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

  // Habit reminders (e.g. Spanish plan)
  const habits = data?.habits || [];
  for (const h of habits) {
    if (!habitReminderDue(h, todayStr, nowMins, dow)) continue;
    const firstSentence = (h.detail || "").split(/(?<=\.)\s/)[0];
    notifications.push({
      title: `${h.title}${h.durationMin ? " · " + h.durationMin + " min" : ""}`,
      message: firstSentence || `Time for ${h.title}.`,
      priority: "default",
      tags: ["books"],
    });
  }

  // Fire all notifications
  await Promise.allSettled(
    notifications.map(n => sendNtfy(n.title, n.message, n.priority, n.tags))
  );

  console.log(`Checked ${events.length} events, ${todos.length} todos, ${habits.length} habits. Sent ${notifications.length} notifications.`);
  return {
    statusCode: 200,
    body: JSON.stringify({ checked: events.length + todos.length, sent: notifications.length }),
  };
};

// Exposed for testing
exports._test = { pacificNow, habitReminderDue };
