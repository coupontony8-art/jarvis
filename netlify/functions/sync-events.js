// Netlify function — receives upcoming events/todos from the app and stores in JSONBin

const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

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

  if (!BIN_ID || !API_KEY) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "JSONBin env vars not set", BIN_ID: !!BIN_ID, API_KEY: !!API_KEY }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const data = {
    events: payload.events || [],
    todos: payload.todos || [],
    updatedAt: new Date().toISOString(),
  };

  console.log("Writing to JSONBin:", BIN_ID, "Events:", data.events.length, "Todos:", data.todos.length);

  try {
    // JSONBin v3 PUT to update bin content
    const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,  // Master key uses X-Master-Key header
        "X-Bin-Versioning": "false",
      },
      body: JSON.stringify(data),
    });

    const responseText = await response.text();
    console.log("JSONBin response:", response.status, responseText);

    if (!response.ok) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "JSONBin write failed", status: response.status, detail: responseText }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, events: data.events.length, todos: data.todos.length }),
    };
  } catch (e) {
    console.error("Fetch error:", e.message);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
