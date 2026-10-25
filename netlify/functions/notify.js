// Netlify function — sends a push notification via ntfy.sh
// Called from the app (URL-callable). Must NOT have a schedule: scheduled
// functions can't be invoked by URL. The 8pm check-in lives in evening-checkin.js.

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
