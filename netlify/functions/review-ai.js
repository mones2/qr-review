// Netlify Function: /.netlify/functions/review-ai
// Uses GROQ_API_KEY (set in Netlify env) to call Groq's Chat Completions API.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: "Method Not Allowed" };
  }

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Missing GROQ_API_KEY" }) };
    }

    const { restaurant, experience, highlight, keywords, extra } = JSON.parse(event.body || "{}");

    const system =
      "You write polished restaurant reviews. Return ONLY one paragraph. 40–60 words, warm fine-dining tone, 1–2 tasteful emojis (🍽 🤝 🌆 🌍 ✨ ❤️ 👍). Mention the restaurant by name. Avoid extreme claims, headings, quotes, or preambles.";

    const user =
`Restaurant: ${restaurant || "Unknown"}
Experience: ${experience || "Good"}
Highlight: ${highlight || "Food"}
Keywords: ${(keywords || []).slice(0,3).join(", ") || "—"}
Optional details: ${extra || "—"}

Write a single paragraph suitable to paste into Google.`;

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0.6,
        max_tokens: 140, // stays under ~60 words
        messages: [
          { role: "system", content: system },
          { role: "user",   content: user }
        ]
      })
    });

    const data = await resp.json();
    const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "").trim();

    return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ text }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "AI call failed", detail: String(err) }) };
  }
};
