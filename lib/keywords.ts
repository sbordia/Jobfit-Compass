import { STOPWORDS } from "./stopwords";

export function topKeywords(text: string, n = 40): string[] {
  const tokens = text.toLowerCase().split(/[^a-z0-9+.#/-]+/).filter(Boolean);
  const counts = new Map<string, number>();
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    if (t.length < 2) continue;
    const key = t;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0, n).map(x=>x[0]);
  return dedupe(sorted).slice(0, n);
}

function dedupe(arr: string[]) {
  return Array.from(new Set(arr));
}

export function coverage(keywords: string[], resumeText: string) {
  const lower = resumeText.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];
  for (const k of keywords) {
    if (lower.includes(k.toLowerCase())) matched.push(k);
    else missing.push(k);
  }
  return { matched, missing };
}

export const BUZZWORDS = [
  "results-driven","detail-oriented","self-starter","go-getter","team player","dynamic","synergy","innovative",
  "hard-working","fast-paced","proactive","strategic thinker","passionate","thought leader","rockstar"
];

export function overusedBuzzwords(text: string) {
  const lower = text.toLowerCase();
  return BUZZWORDS.filter(b => lower.includes(b));
}
