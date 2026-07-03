import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;

/** Server-only. Requires GEMINI_API_KEY in .env.local (get one at
 * https://aistudio.google.com/apikey). */
export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GEMINI_API_KEY. Add it to .env.local to enable document extraction.');
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
