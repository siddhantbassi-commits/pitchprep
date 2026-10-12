// Phase 1 spike: what does Gemini grounding actually return, how fast, and in what shape?
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const [name, firm] = [process.argv[2] || 'Rajan Anandan', process.argv[3] || 'Peak XV Partners'];

const prompt = `Research ${name} of ${firm}. List investments or exits made or announced in the last 90 days (today is ${new Date().toISOString().slice(0, 10)}). For each give company, date, round and source. Be factual; say so if nothing is found.`;

const t0 = Date.now();
const res = await ai.models.generateContent({ model, contents: prompt, config: { tools: [{ googleSearch: {} }] } });
console.log('MODEL', model, 'MS', Date.now() - t0);
console.log('TEXT:\n', res.text?.slice(0, 1500));
const gm = res.candidates?.[0]?.groundingMetadata;
console.log('\nQUERIES', gm?.webSearchQueries);
console.log('CHUNKS', gm?.groundingChunks?.length, gm?.groundingChunks?.slice(0, 4).map((c) => c.web));
console.log('SUPPORTS', gm?.groundingSupports?.length, JSON.stringify(gm?.groundingSupports?.[0]));
console.log('USAGE', JSON.stringify(res.usageMetadata));
