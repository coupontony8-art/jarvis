// Netlify scheduled function — Sunday 9:30am Pacific
// NFL 2026 regular season: Sep 10, 2026 — Jan 4, 2027

const NTFY_TOPIC = process.env.NTFY_TOPIC || "tony-jarvis-2026-abc123";

const SEASON_START = "2026-09-10";
const SEASON_END   = "2027-01-04";

exports.handler = async (event) => {
  const today = new Date().toISOString().slice(0,10);
  if (today < SEASON_START || today > SEASON_END) {
    console.log("Outside NFL season, skipping.");
    return { statusCode: 200, body: "Off season" };
  }

  const messages = [
    "Sunday games start soon. Check your lineup, check injuries, set it. Don't blow your week on a benched player.",
    "Good morning. Fantasy football waits for no one. Set your lineup before kickoff.",
    "Sunday lineup check. You've got time — but not that much time. Do it now.",
    "Hey. Sunday games. Lineup. Now. You know the drill.",
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
