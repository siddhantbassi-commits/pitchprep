import { z } from 'zod';

export const SECTIONS = ['deals', 'thesis', 'context', 'firm'] as const;
export type Section = (typeof SECTIONS)[number];

export const KINDS = [
  'investment', 'exit', 'milestone', 'fund', 'statement', 'retreat', 'pivot', 'controversy', 'portfolio_trouble', 'people_change', 'firm_fact',
] as const;

export interface Evidence {
  id: string; // E1, E2 ...
  url: string;
  domain: string;
  title: string;
  publishedAt: string | null; // ISO date
  tier: 1 | 2 | 3; // 1 official / primary, 2 established press or database, 3 everything else
  text: string; // excerpt the claims are checked against
  origin: 'grounding' | 'site' | 'user';
  fullFetch: boolean; // true when the text came from the page itself, false when it is only Google's attributed excerpt
  fetchedAt: string;
}

// What the extraction model returns for one claim. Everything is checked afterwards in code.
export const RawClaim = z.object({
  section: z.enum(SECTIONS),
  kind: z.enum(KINDS),
  text: z.string().describe('One neutral sentence, max 240 characters'),
  company: z.string().nullable().describe('Portfolio company or other entity concerned, if any'),
  eventDate: z.string().nullable().describe('YYYY-MM-DD when the event happened or was announced; null if the source gives no date'),
  evidenceIds: z.array(z.string()).describe('IDs of the evidence items that support the claim'),
  quote: z.string().describe('A verbatim span (max 200 chars) copied from one cited evidence item that supports the claim'),
  severity: z.enum(['info', 'watch', 'high']).describe('info for neutral facts, watch for things Priya should know, high for serious reported problems'),
});
export type RawClaim = z.infer<typeof RawClaim>;

export const Extraction = z.object({
  identity: z.object({
    found: z.boolean().describe('true only if the evidence shows this named person is associated with this firm'),
    role: z.string().nullable(),
    firmDomain: z.string().nullable(),
    ambiguity: z.string().nullable().describe('Note if several people or firms match the name, otherwise null'),
  }),
  claims: z.array(RawClaim),
});
export type Extraction = z.infer<typeof Extraction>;

export interface Claim extends RawClaim {
  id: string; // C1, C2 ...
  verified: boolean;
  dropReason: string | null;
  dateSource: 'claim' | 'article' | 'none';
  judge: 'supported' | 'partial' | 'unsupported' | 'not_run';
}

export const FounderProfile = z.object({
  founderName: z.string(),
  startup: z.string(),
  oneLiner: z.string(),
  sector: z.string(),
  stage: z.string(),
  raise: z.string(),
  geography: z.string(),
  traction: z.string(),
  differentiators: z.string(),
});
export type FounderProfile = z.infer<typeof FounderProfile>;

export const Synthesis = z.object({
  skim: z.array(z.string()).describe('Exactly 3 short bullets Priya can read in 20 seconds'),
  fit: z.object({
    stage: z.enum(['strong', 'possible', 'weak', 'unknown']),
    sector: z.enum(['strong', 'possible', 'weak', 'unknown']),
    cheque: z.enum(['strong', 'possible', 'weak', 'unknown']),
    rationale: z.string(),
    claimIds: z.array(z.string()),
  }),
  talkingPoints: z.array(z.object({
    title: z.string(),
    angle: z.string().describe('2-3 sentences: what to say and why it lands with this investor'),
    tailoredTo: z.string().describe('The specific fact about the startup (stage, sector, metric) this point uses'),
    opener: z.string().describe('One sentence Priya could say out loud'),
    claimIds: z.array(z.string()).describe('IDs of verified claims this point builds on (at least one)'),
  })),
  likelyQuestions: z.array(z.object({ question: z.string(), prep: z.string() })),
  questionsToAsk: z.array(z.object({
    question: z.string().describe('A question the founder should ask the investor'),
    why: z.string().describe('One sentence on what the answer will tell the founder'),
    claimIds: z.array(z.string()).describe('Verified claim ids the question is anchored to; may be empty for universal diligence questions'),
  })).describe('Three questions for the founder to put to the investor'),
});
export type Synthesis = z.infer<typeof Synthesis>;

export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface StageState {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'failed';
  startedAt?: string;
  endedAt?: string;
  detail?: string;
}

export interface Usage {
  calls: number;
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  groundedQueries: number;
  costUsd: number;
}

export interface BriefResult {
  status: 'complete' | 'partial' | 'unverified';
  investor: { name: string; firm: string; role: string | null; firmDomain: string | null; ambiguity: string | null };
  asOf: string; // ISO timestamp
  windowStart: string; // ISO date
  windowEnd: string;
  claims: Claim[];
  evidence: Evidence[];
  sectionConfidence: Record<Section, Confidence>;
  synthesis: Synthesis | null;
  notes: string[]; // things we could not do or verify, shown to the user
  stats: {
    claimsExtracted: number;
    claimsVerified: number;
    claimsDropped: number;
    sources: number;
    fullTextSources: number;
    latencyMs: number;
  };
  usage: Usage;
}
