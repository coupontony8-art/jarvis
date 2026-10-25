// Netlify scheduled function — Sunday 9:30am Pacific
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
  // Cron fires at both possible UTC times; only send at Sunday 9am Pacific
  const pt = pacificNow();
  if (pt.dow !== 0 || pt.hour !== 9) {
    return { statusCode: 200, body: "Not Sunday 9am Pacific, skipping" };
  }
  const today = pt.date;
  if (today < SEASON_START || today > SEASON_END) {
    console.log("Outside NFL season, skipping.");
    return { statusCode: 200, body: "Off season" };
  }

  const messages = [
    "Sunday. Kickoff soon. Check injuries, set the lineup, then you may scream at the TV.",
    "Fantasy Sunday. Last call on lineups. The waiver wire is watching. Judging.",
    "Lineup deadline approaching. Don't be the guy who started a player on bye. Again.",
    "SUNDAY LINEUP CHECK. Every inactive starter is a tiny tragedy. Prevent tragedy.",
  ];
  const message = messages[Math.floor(Math.random() * messages.length)];

  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: "POST",
    headers: {
      "Title": "🏈 Set Your Fantasy Lineup — Sunday",
      "Priority": "high",
      "Tags": "football,alarm_clock",
      "Click": "https://sprightly-bublanina-852280.netlify.app",
      "Content-Type": "text/plain",
    },
    body: message,
  });

  return { statusCode: 200, body: "Sent" };
};

exports._test = { pacificNow };
