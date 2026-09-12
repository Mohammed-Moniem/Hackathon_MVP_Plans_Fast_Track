import { createHash } from 'node:crypto';
import OpenAI, { toFile } from 'openai';

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  address?: string;
}

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_SPEECH_CHARACTERS = 2000;
const MAX_SEARCH_BYTES = 1024 * 1024;

// Only application-authored messages and safe status metadata cross this boundary.
class ProviderError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = 'ProviderError';
  }
}

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function key(name: 'OPENAI_API_KEY' | 'EXA_API_KEY'): string {
  const value = env(name);
  if (!value) throw new ProviderError(`${name} is not configured.`, 'PROVIDER_NOT_CONFIGURED', 503);
  return value;
}

/** Configuration availability only; this does not probe or verify provider access. */
export function getProviderStatus(): { agents: boolean; voice: boolean; search: boolean } {
  const openai = Boolean(env('OPENAI_API_KEY'));
  return { agents: openai, voice: openai, search: Boolean(env('EXA_API_KEY')) };
}

function timeout(defaultMs: number): number {
  const configured = Number(env('PROVIDER_TIMEOUT_MS'));
  return Number.isFinite(configured) && configured > 0
    ? Math.max(1000, Math.min(120_000, Math.trunc(configured))) : defaultMs;
}

function timeoutError(provider: string): ProviderError {
  return new ProviderError(`${provider} request timed out. Please try again.`, 'PROVIDER_TIMEOUT', 504);
}

function httpError(provider: string, status: number): ProviderError {
  return new ProviderError(`${provider} request failed (HTTP ${status}). Check provider access or try again later.`,
    'PROVIDER_HTTP_ERROR', status === 429 ? 429 : 502);
}

async function request<T>(provider: string, ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(timeoutError(provider));
      controller.abort();
    }, ms);
  });
  try {
    // Covers body consumption as well as headers; the SDK timeout alone stops at headers.
    return await Promise.race([run(controller.signal), deadline]);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (controller.signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError ||
        (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))) {
      throw timeoutError(provider);
    }
    if (error instanceof OpenAI.APIError && typeof error.status === 'number') {
      if (error.status === 429 && (error.code === 'credit_balance_exhausted' || error.code === 'insufficient_quota' || error.type === 'insufficient_quota')) {
        throw new ProviderError('OpenAI API credits are exhausted. Add credits or configure a funded project, then try again.', 'OPENAI_CREDITS_EXHAUSTED', 429);
      }
      throw httpError(provider, error.status);
    }
    if (error instanceof SyntaxError) {
      throw new ProviderError(`${provider} returned an invalid response.`, 'PROVIDER_INVALID_RESPONSE', 502);
    }
    throw new ProviderError(`${provider} connection failed. Please try again.`, 'PROVIDER_CONNECTION_ERROR', 502);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function invalidResponse(provider: string): ProviderError {
  return new ProviderError(`${provider} returned an invalid response.`, 'PROVIDER_INVALID_RESPONSE', 502);
}

async function readBytes(response: Response, maxBytes: number, provider: string, signal: AbortSignal): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw invalidResponse(provider);
  // Cancellation is deliberately not awaited: a broken upstream stream must not block a deadline.
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    const length = Number(response.headers.get('content-length'));
    if (length > maxBytes) throw invalidResponse(provider);
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw invalidResponse(provider);
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  } finally {
    signal.removeEventListener('abort', cancel);
    cancel();
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function sourceURL(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 4096) return undefined;
  const raw = value.trim();
  if (!/^https?:\/\//i.test(raw) || /[\u0000-\u0020\u007f\\]/.test(raw)) return undefined;
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return undefined;
    url.hash = '';
    return url.href;
  } catch { return undefined; }
}

// Official request format: https://exa.ai/docs/reference/search-api-guide-for-coding-agents
export async function searchWeb(query: string, area?: string): Promise<SearchResult[]> {
  if (typeof query !== 'string' || !query.trim() || query.length > 2000 ||
      (area !== undefined && (typeof area !== 'string' || area.length > 200))) {
    throw new ProviderError('Enter a search query of 1–2000 characters and an area of at most 200 characters.', 'INVALID_INPUT', 400);
  }
  const apiKey = key('EXA_API_KEY');
  const searchQuery = area?.trim() ? `${query.trim()} in ${area.trim()}` : query.trim();
  return request('Exa', timeout(15_000), async signal => {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchQuery, type: 'auto', numResults: 5, contents: { text: { maxCharacters: 1000 } } }),
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw httpError('Exa', response.status);
    }
    const payload: unknown = JSON.parse((await readBytes(response, MAX_SEARCH_BYTES, 'Exa', signal)).toString('utf8'));
    if (!object(payload) || !Array.isArray(payload.results)) throw invalidResponse('Exa');
    const results: SearchResult[] = [];
    const seen = new Set<string>();
    for (const item of payload.results) {
      if (!object(item)) continue;
      const url = sourceURL(item.url);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const highlights = Array.isArray(item.highlights) ? item.highlights.filter(v => typeof v === 'string').join(' ') : '';
      results.push({
        id: `exa-${createHash('sha256').update(url).digest('hex').slice(0, 16)}`,
        title: text(item.title, 250) || new URL(url).hostname,
        url, snippet: text(item.text, 1000) || text(highlights, 1000),
      });
      // Only retrieved page text/highlights are used; never infer addresses, hours or summaries.
      if (results.length === 5) break;
    }
    return results;
  });
}

function audioClient(apiKey: string, ms: number): OpenAI {
  return new OpenAI({
    apiKey, baseURL: 'https://api.openai.com/v1', maxRetries: 0, timeout: ms,
    logLevel: 'off', fetch: (input, init) => fetch(input, { ...init, redirect: 'error' }),
  });
}

const audioTypes: Record<string, string[]> = {
  'audio/webm': ['webm'], 'video/webm': ['webm'],
  'audio/mp4': ['m4a', 'mp4'], 'video/mp4': ['mp4', 'm4a'], 'audio/x-m4a': ['m4a'],
  'audio/mpeg': ['mp3', 'mpeg', 'mpga'], 'audio/mp3': ['mp3'],
  'audio/wav': ['wav'], 'audio/x-wav': ['wav'], 'audio/wave': ['wav'],
  'audio/flac': ['flac'], 'audio/x-flac': ['flac'], 'audio/ogg': ['ogg'],
};

// https://developers.openai.com/api/docs/guides/speech-to-text
// https://github.com/openai/openai-node#file-uploads
export async function transcribeAudio(buffer: Buffer, filename: string, mime: string): Promise<string> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ProviderError('Provide a non-empty audio recording.', 'INVALID_INPUT', 400);
  }
  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new ProviderError('Audio recordings must be at most 10 MiB.', 'AUDIO_TOO_LARGE', 413);
  }
  const mediaType = typeof mime === 'string' ? mime.split(';')[0]!.trim().toLowerCase() : '';
  const extensions = Object.hasOwn(audioTypes, mediaType) ? audioTypes[mediaType] : undefined;
  if (!extensions) throw new ProviderError('Unsupported audio format. Use WebM, MP4/M4A, MP3, WAV, FLAC or OGG.', 'UNSUPPORTED_AUDIO_TYPE', 415);
  if (typeof filename !== 'string' || !filename.trim() || filename.length > 255) {
    throw new ProviderError('Provide an audio filename of 1–255 characters.', 'INVALID_INPUT', 400);
  }
  const basename = filename.split(/[\\/]/).pop()!.replace(/[^a-zA-Z0-9._-]/g, '_');
  const extension = basename.split('.').pop()!.toLowerCase();
  const safeName = extensions.includes(extension) ? basename : `recording.${extensions[0]}`;
  const apiKey = key('OPENAI_API_KEY');
  const ms = timeout(60_000);
  return request('OpenAI', ms, async signal => {
    const client = audioClient(apiKey, ms);
    const transcript: unknown = await client.audio.transcriptions.create({
      file: await toFile(buffer, safeName, { type: mediaType }),
      model: env('OPENAI_TRANSCRIPTION_MODEL') || 'gpt-4o-mini-transcribe', response_format: 'json',
    }, { signal });
    if (!object(transcript) || typeof transcript.text !== 'string' || transcript.text.length > 20_000) {
      throw invalidResponse('OpenAI');
    }
    if (!transcript.text.trim()) {
      throw new ProviderError('No speech was detected. Please record again.', 'NO_SPEECH', 422);
    }
    return transcript.text.trim();
  });
}

// https://developers.openai.com/api/docs/guides/text-to-speech
export async function synthesizeSpeech(input: string, coach: 'health' | 'career'): Promise<Buffer> {
  if (typeof input !== 'string' || !input.trim() || input.length > MAX_SPEECH_CHARACTERS) {
    throw new ProviderError('Speech text must contain 1–2000 characters.', 'INVALID_INPUT', 400);
  }
  if (coach !== 'health' && coach !== 'career') {
    throw new ProviderError('Choose the health or career coach.', 'INVALID_INPUT', 400);
  }
  const apiKey = key('OPENAI_API_KEY');
  const ms = timeout(60_000);
  return request('OpenAI', ms, async signal => {
    const client = audioClient(apiKey, ms);
    const response = await client.audio.speech.create({
      model: env('OPENAI_TTS_MODEL') || 'gpt-4o-mini-tts',
      voice: coach === 'health' ? 'coral' : 'cedar', input: input.trim(), response_format: 'mp3',
    }, { signal });
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (contentType !== 'audio/mpeg' && contentType !== 'audio/mp3' && contentType !== 'application/octet-stream') {
      void response.body?.cancel().catch(() => {});
      throw invalidResponse('OpenAI');
    }
    const audio = await readBytes(response, MAX_AUDIO_BYTES, 'OpenAI', signal);
    if (!audio.length) throw invalidResponse('OpenAI');
    return audio;
  });
}
