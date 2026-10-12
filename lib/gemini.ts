// All AI goes through here: Gemini Flash only (exam rule). Tracks tokens, grounded queries and list-price cost.

import { GoogleGenAI, ThinkingLevel } from '@google/genai';

// 'low' roughly halves latency on grounded calls (measured 23 s vs 48 s) with no loss we could see; 'minimal' is not supported on this model.
const LOW = ThinkingLevel.LOW;
import { z } from 'zod';
import type { Usage } from './types';

export const MODEL = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// Paid-tier list prices, USD per 1M tokens, gemini-3.8-flash through 31 Dec 2026 (ai.google.dev/pricing).
const PRICE_IN = Number(process.env.GEMINI_PRICE_IN ?? 0.75);
const PRICE_OUT = Number(process.env.GEMINI_PRICE_OUT ?? 3.75);
const PRICE_SEARCH = 14 / 1000; // per grounded search query after the 5,000/month free allowance (we report list price)

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

export class Meter {
  u: Usage = { calls: 0, promptTokens: 0, outputTokens: 0, thoughtTokens: 0, groundedQueries: 0, costUsd: 0 };
  add(meta: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined, queries = 0) {
    this.u.calls += 1;
    this.u.promptTokens += meta?.promptTokenCount ?? 0;
    this.u.outputTokens += meta?.candidatesTokenCount ?? 0;
    this.u.thoughtTokens += meta?.thoughtsTokenCount ?? 0;
    this.u.groundedQueries += queries;
    this.u.costUsd =
      (this.u.promptTokens / 1e6) * PRICE_IN +
      ((this.u.outputTokens + this.u.thoughtTokens) / 1e6) * PRICE_OUT +
      this.u.groundedQueries * PRICE_SEARCH;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

async function retrying<T>(fn: () => Promise<T>, label: string, tries = 2): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = String((e as Error)?.message ?? e);
      const transient = /429|503|500|UNAVAILABLE|RESOURCE_EXHAUSTED|fetch failed|ECONNRESET/i.test(msg);
      if (!transient || i === tries - 1 || /timed out/.test(msg)) break;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw new Error(`${label}: ${String((last as Error)?.message ?? last).slice(0, 300)}`);
}

export interface GroundedResult {
  text: string;
  supports: { start: number; end: number; text: string; chunkIdx: number[] }[];
  chunks: { uri: string; title: string }[];
  queries: string[];
}

/** One Google-Search-grounded research call. Returns the narrative plus which source supports which span. */
export async function grounded(prompt: string, meter: Meter, timeoutMs = 55_000): Promise<GroundedResult> {
  return retrying(async () => {
    const res = await withTimeout(
      ai().models.generateContent({
        model: MODEL(),
        contents: prompt,
        config: { tools: [{ googleSearch: {} }], temperature: 0.1, thinkingConfig: { thinkingLevel: LOW } },
      }),
      timeoutMs,
      'grounded call',
    );
    const gm = res.candidates?.[0]?.groundingMetadata;
    meter.add(res.usageMetadata, gm?.webSearchQueries?.length ?? 0);
    return {
      text: res.text ?? '',
      supports: (gm?.groundingSupports ?? []).map((s) => ({
        start: s.segment?.startIndex ?? 0,
        end: s.segment?.endIndex ?? 0,
        text: s.segment?.text ?? '',
        chunkIdx: s.groundingChunkIndices ?? [],
      })),
      chunks: (gm?.groundingChunks ?? []).map((c) => ({ uri: c.web?.uri ?? '', title: c.web?.title ?? '' })),
      queries: gm?.webSearchQueries ?? [],
    };
  }, 'grounded');
}

/** Structured output with no tools: used for extraction, judging and synthesis, where the input is data we hold. */
export async function structured<S extends z.ZodType>(
  schema: S,
  system: string,
  prompt: string,
  meter: Meter,
  timeoutMs = 30_000,
): Promise<z.infer<S>> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return retrying(async () => {
    const res = await withTimeout(
      ai().models.generateContent({
        model: MODEL(),
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchema,
          temperature: 0.1,
          thinkingConfig: { thinkingLevel: LOW },
        },
      }),
      timeoutMs,
      'structured call',
    );
    meter.add(res.usageMetadata);
    const raw = res.text ?? '';
    return schema.parse(JSON.parse(raw));
  }, 'structured');
}

/** Reads a PDF with Gemini's native document understanding and returns plain text. The file is sent inline and never stored. */
export async function transcribePdf(bytes: Buffer, instruction: string, meter: Meter, timeoutMs = 70_000): Promise<string> {
  return retrying(async () => {
    const res = await withTimeout(
      ai().models.generateContent({
        model: MODEL(),
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/pdf', data: bytes.toString('base64') } }, { text: instruction }] }],
        config: { temperature: 0, thinkingConfig: { thinkingLevel: LOW } },
      }),
      timeoutMs,
      'pdf transcription',
    );
    meter.add(res.usageMetadata);
    return res.text ?? '';
  }, 'transcribe');
}

/** What to tell a user when every search failed. A quota error is not "try again in a minute": it renews daily. */
export function searchUnavailableMessage(reasons: unknown[]): string {
  const quota = reasons.some((r) => /429|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(String((r as Error)?.message ?? r)));
  return quota
    ? 'Live-search capacity for today has been used up, so new briefs and investor searches cannot run right now. The example briefs, your saved briefs and everything else still work. Capacity renews daily (around 1 PM India time); please try again then.'
    : 'Live search is unavailable right now. Please try again in a minute.';
}
