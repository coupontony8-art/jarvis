// Netlify scheduled function — daily 8pm Pacific "Evening Review" push
// Scheduled in netlify.toml at 03:00 and 04:00 UTC; only the run that lands at
// 8pm Pacific sends, so it stays correct across daylight saving changes.
// Shows today's daily goals (Daily Unlock progress) and tomorrow's timed events,
// both read from the app's last JSONBin sync.

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

// The app's last sync (null if unavailable)
async function loadSynced() {
  if (!BIN_ID || !API_KEY) return null;
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: { "X-Master-Key": API_KEY } });
    return (await res.json())?.record || null;
  } catch (e) {
    console.error("JSONBin fetch failed:", e.message);
    return null;
  }
}

function tomorrowsEvents(record, tomorrow) {
  if (!record) return null;
  return (record.events || [])
    .filter(e => e.date === tomorrow && e.time)
    .sort((a, b) => a.time.localeCompare(b.time));
}

// Today's goals line(s) from the app's Daily Unlock snapshot
function goalsText(record, today) {
  if (!record) return "Today's goals: couldn't load. Open Jarvis to check.";
  const g = record.dailyGoals;
  if (!g || g.date !== today) return "Today's goals: nothing checked off in Jarvis today.";
  if (!g.total) return "Today's goals: none scheduled today.";
  if (g.done >= g.total) {
    return `Today's goals: ${g.done}/${g.total} done ✓` + (g.claimed ? ` · ${g.reward || "reward"} claimed` : ` · ${g.reward || "reward"} unlocked, go claim it`);
  }
  const left = (g.remaining || []);
  const list = left.slice(0, 5).join(", ") + (left.length > 5 ? `, +${left.length - 5} more` : "");
  return `Today's goals: ${g.done}/${g.total} done\nStill open: ${list}`;
}

function buildMessage(now, record, today, tomorrowStr) {
  const events = tomorrowsEvents(record, tomorrowStr);
  const day = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Los_Angeles" });
  const date = now.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Los_Angeles" });
  const quips = [
    `Evening review, Tony. ${day}, ${date}. The habits are waiting. They're always waiting.`,
    `${day} evening. Your dashboard has been staring at the door all day. Open Jarvis.`,
    `End of day, ${day}. Log your habits before they file a complaint.`,
    `${day} evening. The system would like a word. Several words. Open Jarvis.`,
    `Daily review. ${date}. Two minutes, then you may return to your life. Probably.`,
  ];
  const quip = quips[Math.floor(Math.random() * quips.length)];
  let tomorrow;
  if (events === null) tomorrow = "Tomorrow: couldn't load your calendar. Open Jarvis to check.";
  else if (!events.length) tomorrow = "Tomorrow: nothing scheduled.";
  else tomorrow = "Tomorrow:\n" + events.map(e => `• ${formatTime(e.time)} — ${e.title}`).join("\n");
  return `${goalsText(record, today)}\n\n${tomorrow}\n\n${quip}`;
}

exports.handler = async () => eveningReview();

// ─── SCHEDULED: daily 8pm Pacific Evening Review ────────────────────────────
async function eveningReview(now = new Date()) {
  const pn = pacificNow(now);
  if (pn.hour !== EVENING_HOUR) {
    return { statusCode: 200, body: JSON.stringify({ skipped: "not 8pm Pacific" }) };
  }
  const record = await loadSynced();
  await sendNtfy({
    title: "⚡ Jarvis — Evening Review",
    message: buildMessage(now, record, pn.date, addDays(pn.date, 1)),
    tags: ["calendar", "bell"],
  });
  console.log(`Evening Review sent (synced data ${record ? "loaded" : "unavailable"}).`);
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}

exports._test = { pacificNow, eveningReview, buildMessage, addDays, goalsText };
