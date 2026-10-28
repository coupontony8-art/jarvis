// Netlify scheduled function — Thursday 4:30pm Pacific
// NFL 2026 regular season: Sep 10, 2026 — Jan 4, 2027

const NTFY_TOPIC = process.env.NTFY_TOPIC || "tony-jarvis-2026-abc123";

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

const SEASON_START = "2026-09-10";
const SEASON_END   = "2027-01-04";

exports.handler = async (event) => {
  // Cron fires at both possible UTC times; only send at Thursday 4pm Pacific
  const pt = pacificNow();
  if (pt.dow !== 4 || pt.hour !== 16) {
    return { statusCode: 200, body: "Not Thursday 4pm Pacific, skipping" };
  }
  const today = pt.date;
  if (today < SEASON_START || today > SEASON_END) {
    console.log("Outside NFL season, skipping.");
    return { statusCode: 200, body: "Off season" };
  }

  const messages = [
    "Thursday kickoff is coming. Set your lineup or the bench gremlins eat your points.",
    "Lineup check. NOW. Injuries, byes, that guy you keep forgetting to start. Lock it in.",
    "Thursday game soon. If you leave points on the bench again I'm telling everyone.",
    "LINEUP. THURSDAY. GO. This message will not self-destruct, but your season might.",
  ];
  const message = messages[Math.floor(Math.random() * messages.length)];

  await sendNtfy({ title: "🏈 Set Your Fantasy Lineup — Thursday", message, priority: "high", tags: ["football", "alarm_clock"] });

  return { statusCode: 200, body: "Sent" };
};


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

exports._test = { pacificNow };
