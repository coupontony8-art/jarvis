// Netlify scheduled function — daily 8pm Pacific evening check-in
// Scheduled in netlify.toml at 03:00 and 04:00 UTC; only the run that lands at
// 8pm Pacific sends, so it stays correct across daylight saving changes.
// Includes tomorrow's events that have a time (read from the app's JSONBin sync).

const NTFY_TOPIC = process.env.NTFY_TOPIC || "tony-jarvis-2026-abc123";
const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;
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

function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

function formatTime(t) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
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

// Tomorrow's events with a time, from the app's last sync (null if unavailable)
async function tomorrowsEvents(tomorrow) {
  if (!BIN_ID || !API_KEY) return null;
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: { "X-Master-Key": API_KEY } });
    const events = (await res.json())?.record?.events || [];
    return events
      .filter(e => e.date === tomorrow && e.time)
      .sort((a, b) => a.time.localeCompare(b.time));
  } catch (e) {
    console.error("JSONBin fetch failed:", e.message);
    return null;
  }
}

function buildMessage(now, events) {
  const day = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Los_Angeles" });
  const date = now.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Los_Angeles" });
  const quips = [
    `Evening check-in, Tony. ${day}, ${date}. The habits are waiting. They're always waiting.`,
    `${day} evening. Your dashboard has been staring at the door all day. Open Jarvis.`,
    `End of day, ${day}. Log your habits before they file a complaint.`,
    `${day} evening. The system would like a word. Several words. Open Jarvis.`,
    `Daily check-in. ${date}. Two minutes, then you may return to your life. Probably.`,
  ];
  const quip = quips[Math.floor(Math.random() * quips.length)];
  let tomorrow;
  if (events === null) tomorrow = "Tomorrow: couldn't load your calendar. Open Jarvis to check.";
  else if (!events.length) tomorrow = "Tomorrow: nothing scheduled.";
  else tomorrow = "Tomorrow:\n" + events.map(e => `• ${formatTime(e.time)} — ${e.title}`).join("\n");
  return `${tomorrow}\n\n${quip}`;
}

exports.handler = async () => eveningCheckIn();

// ─── SCHEDULED: daily 8pm Pacific check-in ───────────────────────────────────
async function eveningCheckIn(now = new Date()) {
  const pn = pacificNow(now);
  if (pn.hour !== EVENING_HOUR) {
    return { statusCode: 200, body: JSON.stringify({ skipped: "not 8pm Pacific" }) };
  }
  const events = await tomorrowsEvents(addDays(pn.date, 1));
  await sendNtfy({
    title: "⚡ Jarvis — Evening Check-in",
    message: buildMessage(now, events),
    tags: ["calendar", "bell"],
  });
  console.log(`Evening check-in sent (${events ? events.length : "?"} events tomorrow).`);
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}

exports._test = { pacificNow, eveningCheckIn, buildMessage, addDays };
