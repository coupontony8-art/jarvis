// Netlify scheduled function — fires every morning at 8am Pacific
// Schedule configured in netlify.toml
// Sends a push notification to all subscribed devices

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:tony@jarvis.app";

// Web Push implementation using VAPID
// Uses the web-push npm package (installed automatically by Netlify)
const webpush = require("web-push");

exports.handler = async (event) => {
  // Netlify scheduled functions pass event.body with schedule info
  // But we also allow manual POST trigger for testing
  
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error("VAPID keys not set");
    return { statusCode: 500, body: "VAPID keys missing" };
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  // Get subscriptions from Netlify Blobs
  const { getStore } = require("@netlify/blobs");
  const store = getStore("push-subscriptions");

  let subscriptions = [];
  try {
    const raw = await store.get("subscriptions");
    if (raw) subscriptions = JSON.parse(raw);
  } catch (e) {
    console.log("No subscriptions yet:", e.message);
    return { statusCode: 200, body: "No subscriptions" };
  }

  if (!subscriptions.length) {
    return { statusCode: 200, body: "No subscribers" };
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 10 ? "Morning" : hour < 14 ? "Hey" : "Evening";

  const payload = JSON.stringify({
    title: "Jarvis — Daily Briefing",
    body: `${greeting}, Tony. Tap to see your day.`,
    tag: "morning-brief",
    url: "/",
  });

  const results = await Promise.allSettled(
    subscriptions.map(sub => webpush.sendNotification(sub, payload))
  );

  const sent = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  console.log(`Sent: ${sent}, Failed: ${failed}`);

  return { statusCode: 200, body: JSON.stringify({ sent, failed }) };
};
