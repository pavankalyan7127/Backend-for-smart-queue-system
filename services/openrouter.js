// backend/services/openrouter.js
import fetch from "node-fetch";

const BASE = "https://openrouter.ai/api/v1/chat/completions";

export async function callOpenRouter(apiKey, model, messages, max_tokens = 2000) {
  const body = {
    model,
    messages,
    max_tokens
  };

  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${txt}`);
  }
  return res.json();
}
