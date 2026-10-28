// Netlify scheduled function — runs every 30 minutes
// Reads synced data from JSONBin and sends habit reminders (habits with a reminder time)

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

  // Current time in Pacific (handles daylight saving automatically)
  const { todayStr, nowMins, dow } = pacificNow(new Date());
  // Runs are scheduled on :00/:30 but can start a few minutes late. Windows are
  // decided by the scheduled slot so a late run never double-sends or skips.
  const slotMins = nowMins - (nowMins % 30);

  const notifications = [];


  // (Events no longer get pushes beforehand — the 8pm Evening Review lists tomorrow's timed events.)
  // (To-dos no longer get push reminders.)

  // Habit reminders (e.g. Spanish plan)
  const habits = data?.habits || [];
  for (const h of habits) {
    if (!habitReminderDue(h, todayStr, slotMins, dow)) continue;
    const firstSentence = (h.detail || "").split(/(?<=\.)\s/)[0];
    notifications.push({
      title: `${h.title}${h.durationMin ? " · " + h.durationMin + " min" : ""}`,
      message: firstSentence || `Time for ${h.title}.`,
      priority: "default",
      tags: ["books"],
    });
  }

  // Fire all notifications
  const results = await Promise.allSettled(notifications.map(n => sendNtfy(n)));
  results.forEach((r, i) => { if (r.status === "rejected") console.error("Push failed:", notifications[i].title, r.reason?.message); });

  console.log(`Checked ${events.length} events, ${habits.length} habits. Sent ${results.filter(r => r.status === "fulfilled").length}/${notifications.length} notifications.`);
  return {
    statusCode: 200,
    body: JSON.stringify({ checked: events.length + habits.length, sent: results.filter(r => r.status === "fulfilled").length }),
  };
};

// Exposed for testing
exports._test = { pacificNow, habitReminderDue };
