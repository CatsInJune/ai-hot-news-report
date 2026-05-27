import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenRouter(): OpenAI | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  if (!_client) {
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "AI Hot News Monitor",
      },
    });
  }

  return _client;
}

export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash";
