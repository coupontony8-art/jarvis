// Netlify function — saves a push subscription from the browser
// Called once when the user grants notification permission

const { getStore } = require("@netlify/blobs");

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

  let subscription;
  try {
    subscription = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  try {
    const store = getStore("push-subscriptions");
    let subscriptions = [];
    try {
      const raw = await store.get("subscriptions");
      if (raw) subscriptions = JSON.parse(raw);
    } catch {}

    // Avoid duplicate endpoints
    const exists = subscriptions.some(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      subscriptions.push(subscription);
      await store.set("subscriptions", JSON.stringify(subscriptions));
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, count: subscriptions.length }),
    };
  } catch (e) {
    console.error("Save subscription error:", e);
    return { statusCode: 500, body: e.message };
  }
};
