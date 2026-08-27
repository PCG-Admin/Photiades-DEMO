import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;

/**
 * Server-only Gemini client routed through the PCG Cloudflare AI Gateway.
 */
export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const token = process.env.CF_AIG_TOKEN;
    const accountId = process.env.CF_ACCOUNT_ID;
    const gatewayId = process.env.CF_GATEWAY_ID;

    if (!token) {
      throw new Error('Missing CF_AIG_TOKEN.');
    }

    if (!accountId) {
      throw new Error('Missing CF_ACCOUNT_ID.');
    }

    if (!gatewayId) {
      throw new Error('Missing CF_GATEWAY_ID.');
    }

    client = new GoogleGenAI({
      apiKey: token,
      httpOptions: {
        baseUrl: `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/google-ai-studio`,
        headers: {
          'cf-aig-authorization': `Bearer ${token}`,
          'cf-aig-byok-alias': 'photiades',
          'cf-aig-metadata': JSON.stringify({ client: 'pcg-demos' }),
        },
      },
    });
  }

  return client;
}