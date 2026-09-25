import { env } from '../../env.js';
import type { SearchHit } from './search.js';

export interface AssistantAnswer {
  answer: string;
  /** Дали одговорот е поддржан од контекст (false = нема доволно знаење). */
  grounded: boolean;
}

export interface AssistantProvider {
  answer(question: string, context: SearchHit[]): Promise<AssistantAnswer>;
}

const SYSTEM_PROMPT = [
  'Ти си интерен помошник на GoDigital Task Manager.',
  'Одговарај ИСКЛУЧИВО од дадениот контекст (знаење од системот), на македонска кирилица.',
  'Ако одговорот не е во контекстот, кажи дека немаш доволно информации — не измислувај.',
  'Биди краток и конкретен. Не менуваш ништо — само читаш и објаснуваш.',
].join(' ');

function contextText(context: SearchHit[]): string {
  return context.map((c, i) => `[${i + 1}] (${c.sourceType}) ${c.text}`).join('\n');
}

/** Детерминистички stub (dev/тест): состав одговор од најрелевантните порции, без LLM. */
export class StubAssistantProvider implements AssistantProvider {
  async answer(question: string, context: SearchHit[]): Promise<AssistantAnswer> {
    if (context.length === 0) {
      return { answer: 'Немам доволно информации во знаењето за да одговорам.', grounded: false };
    }
    const top = context
      .slice(0, 3)
      .map((c, i) => `[${i + 1}] ${c.text}`)
      .join(' ');
    return {
      answer: `Врз основа на знаењето (${context.length} извори): ${top}`,
      grounded: true,
    };
  }
}

/**
 * Реален Claude помошник преку backend proxy (§2 — НИКОГАШ клуч на frontend). Raw HTTP за да
 * не воведе нова зависност (@anthropic-ai/sdk) без одлука (§18). Се користи само со
 * `ANTHROPIC_API_KEY`; adaptive thinking + refusal handling по claude-api насоките.
 */
export class ClaudeAssistantProvider implements AssistantProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async answer(question: string, context: SearchHit[]): Promise<AssistantAnswer> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        messages: [
          {
            role: 'user',
            content: `Прашање: ${question}\n\nКонтекст:\n${contextText(context)}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const json = (await res.json()) as {
      stop_reason?: string;
      content?: Array<{ type: string; text?: string }>;
    };
    if (json.stop_reason === 'refusal') {
      return { answer: 'Барањето беше одбиено од безбедносни причини.', grounded: false };
    }
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')
      .trim();
    return { answer: text || 'Немам одговор.', grounded: context.length > 0 };
  }
}

/**
 * Claude преку Claude Code CLI (терминал) — користи ЛОКАЛНА претплата (Max), БЕЗ API клуч.
 * Промптот (систем + прашање + контекст) оди преку STDIN (без кориснички внес во командата →
 * без shell-injection). Одговорот е `result` од `--output-format json`.
 * Забелешка: на VPS мора `claude` да е инсталиран и најавен (claude login) за да работи.
 */
export class ClaudeCliProvider implements AssistantProvider {
  constructor(private readonly cliPath: string) {}

  async answer(question: string, context: SearchHit[]): Promise<AssistantAnswer> {
    const { spawn } = await import('node:child_process');
    const prompt = `${SYSTEM_PROMPT}\n\nПрашање: ${question}\n\nКонтекст:\n${contextText(context)}`;
    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn(this.cliPath, ['-p', '--output-format', 'json'], { shell: true });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error('Claude CLI timeout.'));
      }, 90_000);
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stdout);
        else reject(new Error(`Claude CLI exit ${code}: ${stderr.slice(0, 200)}`));
      });
      child.stdin.write(prompt);
      child.stdin.end();
    });
    const json = JSON.parse(out) as { subtype?: string; is_error?: boolean; result?: string };
    if (json.is_error || json.subtype !== 'success') {
      return { answer: 'Помошникот не успеа да одговори.', grounded: false };
    }
    const text = (json.result ?? '').trim();
    return { answer: text || 'Немам одговор.', grounded: context.length > 0 };
  }
}

let singleton: AssistantProvider | null = null;

/** Фабрика по `CLAUDE_MODE`: cli (терминал/претплата) · api (клуч) · stub (dev/тест). */
export function getAssistantProvider(): AssistantProvider {
  if (!singleton) {
    if (env.CLAUDE_MODE === 'cli') {
      singleton = new ClaudeCliProvider(env.CLAUDE_CLI_PATH);
    } else if (env.CLAUDE_MODE === 'api' && env.ANTHROPIC_API_KEY) {
      singleton = new ClaudeAssistantProvider(env.ANTHROPIC_API_KEY, env.CLAUDE_MODEL);
    } else {
      singleton = new StubAssistantProvider();
    }
  }
  return singleton;
}

/** За тестови: инјектирај/ресетирај го провајдерот. */
export function setAssistantProvider(p: AssistantProvider | null): void {
  singleton = p;
}
