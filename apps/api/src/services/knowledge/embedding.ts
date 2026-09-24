import { env } from '../../env.js';

export interface EmbeddingProvider {
  readonly model: string;
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

/**
 * Детерминистички stub embedding (dev/тест): стабилен нормализиран вектор изведен од текстот.
 * Ист текст → ист вектор (cosine растојание 0), па exact-match пребарувањата се тестабилни.
 * Семантиката ја носи FTS (tsv) страната во хибридното пребарување.
 */
export class StubEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'stub-1024';
  constructor(readonly dim: number) {}
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => stubVector(t, this.dim));
  }
}

function stubVector(text: string, dim: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let seed = h >>> 0;
  const v = new Array<number>(dim);
  for (let i = 0; i < dim; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    v[i] = (seed / 0xffffffff) * 2 - 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

/** Реален Voyage провајдер (D-10). Се користи само со `VOYAGE_API_KEY`; инаку факторијата бира stub. */
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    readonly dim: number,
  ) {}
  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ input: texts, model: this.model }),
    });
    if (!res.ok) throw new Error(`Voyage ${res.status}`);
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return json.data.map((d) => d.embedding);
  }
}

let singleton: EmbeddingProvider | null = null;

/** Фабрика: реален Voyage ако има клуч и провајдерот не е `stub`, инаку детерминистички stub. */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (!singleton) {
    singleton =
      env.EMBED_PROVIDER === 'voyage' && env.VOYAGE_API_KEY
        ? new VoyageEmbeddingProvider(env.VOYAGE_API_KEY, env.EMBED_MODEL, env.EMBED_DIM)
        : new StubEmbeddingProvider(env.EMBED_DIM);
  }
  return singleton;
}

/** За тестови: инјектирај/ресетирај го провајдерот. */
export function setEmbeddingProvider(p: EmbeddingProvider | null): void {
  singleton = p;
}

/** Форматирај JS број-вектор во pgvector литерал (`[0.1,0.2,...]`). */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}
