// Protocol: https://docs.slack.dev/apis/events-api/using-socket-mode/
// This adapter deliberately makes exactly one HTTP attempt per call, including sends.
import type { KnownBlock } from '@slack/types';

type Json = Record<string, unknown>;
export const object = (value: unknown): Json | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Json : undefined;

export interface SlackMessage {
  ts?: string; text?: string; user?: string; bot_id?: string; thread_ts?: string;
  metadata?: { event_type?: string; event_payload?: Json };
}
interface ApiResult { ok: true }
interface AuthResult extends ApiResult { team_id?: string; user_id?: string; bot_id?: string }
interface MessageResult extends ApiResult { channel?: string; ts?: string }
interface MessageInput {
  channel: string; text: string; thread_ts?: string; blocks?: KnownBlock[];
  metadata?: { event_type: string; event_payload: Json };
  unfurl_links?: boolean; unfurl_media?: boolean;
}
export interface SlackResponse { text: string; blocks?: KnownBlock[]; response_type: 'ephemeral'; replace_original: false }
export interface SlackSocket {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener(type: 'error' | 'close', listener: () => void): void;
}
export interface SlackNativeOptions {
  fetch?: typeof globalThis.fetch;
  createWebSocket?: (url: string) => SlackSocket;
  requestTimeoutMs?: number;
  connectionTimeoutMs?: number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  maxReconnectAttempts?: number;
  random?: () => number;
}

const knownErrors = new Set(['invalid_auth', 'not_authed', 'token_revoked', 'account_inactive', 'missing_scope',
  'not_allowed_token_type', 'app_not_enabled', 'ratelimited', 'channel_not_found', 'not_in_channel',
  'thread_not_found', 'message_not_found', 'internal_error', 'fatal_error', 'access_denied', 'link_disabled']);
const terminalErrors = new Set(['invalid_auth', 'not_authed', 'token_revoked', 'account_inactive',
  'missing_scope', 'not_allowed_token_type', 'app_not_enabled', 'access_denied', 'link_disabled']);

export class SlackApiError extends Error {
  constructor(readonly code: string, readonly status?: number, readonly retryAfterMs?: number) {
    super(`Slack request failed (${code}). No automatic message retry was attempted.`);
    this.name = 'SlackApiError';
  }
}

export class SlackWebClient {
  private readonly fetcher: typeof globalThis.fetch;
  private readonly timeout: number;
  private authResult?: AuthResult;
  constructor(private readonly botToken: string, private readonly appToken: string, options: SlackNativeOptions = {}) {
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.timeout = Math.min(30_000, Math.max(1, options.requestTimeoutMs ?? 10_000));
  }
  get identity() { return this.authResult; }

  readonly auth = { test: async (): Promise<AuthResult> => {
    const result = await this.call<AuthResult>('auth.test');
    this.authResult = result;
    return result;
  } };
  readonly chat = {
    postMessage: (input: MessageInput) => this.call<MessageResult>('chat.postMessage', input),
    update: (input: MessageInput & { ts: string }) => this.call<MessageResult>('chat.update', input),
    postEphemeral: (input: MessageInput & { user: string }) => this.call<ApiResult>('chat.postEphemeral', input),
  };
  readonly conversations = {
    info: (input: { channel: string }) => this.call<ApiResult & { channel?: { id?: string; is_private?: boolean; is_member?: boolean } }>('conversations.info', input, 'GET'),
    replies: (input: { channel: string; ts: string; cursor?: string; limit: number; include_all_metadata: boolean }, signal?: AbortSignal) =>
      this.call<ApiResult & { messages?: SlackMessage[]; has_more?: boolean; response_metadata?: { next_cursor?: string } }>('conversations.replies', input, 'GET', signal),
  };
  readonly apps = { connections: { open: (signal?: AbortSignal) =>
    this.call<ApiResult & { url?: string }>('apps.connections.open', {}, 'POST', signal, true) } };

  private async request(url: string, init: RequestInit, signal?: AbortSignal): Promise<string> {
    try {
      const response = await this.fetcher(url, { ...init, redirect: 'error', signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(this.timeout)]) : AbortSignal.timeout(this.timeout) });
      if (!response.ok) {
        const seconds = Number(response.headers.get('retry-after'));
        const retryAfterMs = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : undefined;
        void response.body?.cancel().catch(() => {});
        throw new SlackApiError(response.status === 429 ? 'ratelimited' : 'http_error', response.status, retryAfterMs);
      }
      // Bound both the deadline (including body consumption) and accepted payload size.
      const reader = response.body?.getReader();
      if (!reader) throw new SlackApiError('invalid_response');
      const decoder = new TextDecoder();
      let body = '', size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 2 * 1024 * 1024) {
            void reader.cancel().catch(() => {});
            throw new SlackApiError('response_too_large');
          }
          body += decoder.decode(part.value, { stream: true });
        }
        return body + decoder.decode();
      } finally { reader.releaseLock(); }
    } catch (error) {
      if (error instanceof SlackApiError) throw error;
      // Native network errors may contain URLs/tickets. Never retain or forward them.
      throw new SlackApiError('network_or_timeout');
    }
  }

  private async call<T extends ApiResult>(method: string, input: object = {}, verb: 'GET' | 'POST' = 'POST', signal?: AbortSignal, appLevel = false): Promise<T> {
    const token = appLevel ? this.appToken : this.botToken;
    if (!token || !(appLevel ? /^xapp-/ : /^xoxb-/).test(token)) throw new SlackApiError('not_configured');
    const url = new URL(`https://slack.com/api/${method}`);
    if (verb === 'GET') for (const [key, value] of Object.entries(input)) if (value !== undefined) url.searchParams.set(key, String(value));
    const body = await this.request(url.href, {
      method: verb, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      ...(verb === 'POST' ? { body: JSON.stringify(input) } : {}),
    }, signal);
    let result: Json | undefined;
    try { result = object(JSON.parse(body)); } catch { throw new SlackApiError('invalid_response'); }
    if (result?.ok !== true) throw new SlackApiError(typeof result?.error === 'string' && knownErrors.has(result.error) ? result.error : 'api_error');
    return result as unknown as T;
  }

  async respond(responseUrl: string, input: SlackResponse): Promise<void> {
    let url: URL;
    try { url = new URL(responseUrl); } catch { throw new SlackApiError('invalid_response_url'); }
    if (url.protocol !== 'https:' || !['hooks.slack.com', 'hooks.slack-gov.com'].includes(url.hostname)
      || url.username || url.password || url.port || !/^\/(actions|services)\//.test(url.pathname)) {
      throw new SlackApiError('invalid_response_url');
    }
    // response_url is itself a scoped secret; do not attach the bot's bearer token.
    const body = await this.request(url.href, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(input) });
    if (body.trim() === 'ok') return;
    try { if (object(JSON.parse(body))?.ok === true) return; } catch { /* reject malformed responses */ }
    throw new SlackApiError('invalid_response');
  }
}

export type SlackEnvelope = Json & { type: string; envelope_id: string; payload: Json };
export class SlackNativeApp {
  readonly client: SlackWebClient;
  private readonly options: SlackNativeOptions;
  private socket?: SlackSocket;
  private connection?: Promise<void>;
  private connectionAbort?: AbortController;
  private cancelHandshake?: () => void;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private running = false;
  private generation = 0;
  private retries = 0;
  private currentStatus: 'stopped' | 'connecting' | 'connected' | 'reconnecting' | 'failed' = 'stopped';
  private readonly seen = new Map<string, number>();
  private handler: (envelope: SlackEnvelope) => Promise<void> = async () => {};
  private errorHandler: () => void = () => {};

  constructor(botToken: string, appToken: string, options: SlackNativeOptions = {}) {
    this.options = options;
    this.client = new SlackWebClient(botToken, appToken, options);
  }
  get status() { return this.currentStatus; }
  onEnvelope(handler: (envelope: SlackEnvelope) => Promise<void>) { this.handler = handler; }
  error(handler: () => void) { this.errorHandler = handler; }
  private report() { try { this.errorHandler(); } catch { /* do not leak payloads from logging */ } }

  async start(): Promise<void> {
    if (this.running) return this.connection;
    if (!this.options.createWebSocket && typeof globalThis.WebSocket !== 'function') throw new SlackApiError('websocket_unavailable');
    this.running = true;
    this.retries = 0;
    this.currentStatus = 'connecting';
    try { await this.connect(); }
    catch (error) {
      if (this.running) { this.running = false; this.currentStatus = 'failed'; }
      throw error;
    }
  }
  async stop(): Promise<void> {
    this.running = false;
    this.generation++;
    this.currentStatus = 'stopped';
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.connectionAbort?.abort();
    this.cancelHandshake?.();
    const socket = this.socket;
    this.socket = undefined;
    try { socket?.close(); } catch { /* already closed */ }
    // Let an aborted open/handshake settle before a caller starts a new lifecycle.
    await this.connection?.catch(() => {});
  }

  private connect(): Promise<void> {
    if (this.connection) return this.connection;
    const work = this.connectOnce();
    this.connection = work;
    void work.finally(() => { if (this.connection === work) this.connection = undefined; }).catch(() => {});
    return work;
  }
  private async connectOnce(): Promise<void> {
    const generation = ++this.generation;
    const abort = new AbortController();
    this.connectionAbort = abort;
    const result = await this.client.apps.connections.open(abort.signal);
    if (!this.running || generation !== this.generation) throw new SlackApiError('connection_stopped');
    let url: URL;
    try { url = new URL(result.url ?? ''); } catch { throw new SlackApiError('invalid_socket_url'); }
    if (url.protocol !== 'wss:' || !url.hostname.endsWith('.slack.com') || url.username || url.password || url.port) throw new SlackApiError('invalid_socket_url');
    let socket: SlackSocket;
    try { socket = (this.options.createWebSocket ?? (url => new globalThis.WebSocket(url)))(url.href); }
    catch { throw new SlackApiError('socket_connection_failed'); }
    this.socket = socket;
    const openedAt = Date.now();
    await new Promise<void>((resolve, reject) => {
      let ready = false, settled = false;
      const active = () => this.running && this.socket === socket && this.generation === generation;
      const timer = setTimeout(() => lose(new SlackApiError('socket_hello_timeout')), Math.min(30_000, Math.max(1, this.options.connectionTimeoutMs ?? 10_000)));
      const finish = (error?: SlackApiError) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        this.cancelHandshake = undefined;
        if (error) reject(error); else resolve();
      };
      const lose = (error: SlackApiError) => {
        if (!active()) return;
        this.socket = undefined;
        try { socket.close(); } catch { /* already closed */ }
        finish(error);
        if (ready) {
          if (Date.now() - openedAt >= 30_000) this.retries = 0;
          this.scheduleReconnect(error);
        }
      };
      this.cancelHandshake = () => finish(new SlackApiError('connection_stopped'));
      socket.addEventListener('close', () => lose(new SlackApiError('socket_closed')));
      socket.addEventListener('error', () => lose(new SlackApiError('socket_connection_failed')));
      socket.addEventListener('message', event => {
        if (!active() || typeof event.data !== 'string' || event.data.length > 2 * 1024 * 1024) return;
        let frame: Json | undefined;
        try { frame = object(JSON.parse(event.data)); } catch { this.report(); return; }
        if (!frame) return;
        // ACK synchronously before authorization, deduplication, model work or HTTP calls.
        if (typeof frame.envelope_id === 'string') {
          try { socket.send(JSON.stringify({ envelope_id: frame.envelope_id })); }
          catch { lose(new SlackApiError('socket_ack_failed')); return; }
        }
        if (frame.type === 'hello') { ready = true; this.currentStatus = 'connected'; finish(); return; }
        if (frame.type === 'disconnect') { lose(new SlackApiError(frame.reason === 'link_disabled' ? 'link_disabled' : 'socket_refresh')); return; }
        const payload = object(frame.payload);
        if (!ready || typeof frame.envelope_id !== 'string' || !payload || !['events_api', 'interactive'].includes(String(frame.type))) return;
        const action = Array.isArray(payload.actions) ? object(payload.actions[0]) : undefined;
        const key = frame.type === 'events_api' && typeof payload.event_id === 'string'
          ? `event:${payload.team_id}:${payload.event_id}`
          : frame.type === 'interactive' && typeof action?.action_ts === 'string'
            ? JSON.stringify([payload.type, object(payload.team)?.id, object(payload.user)?.id, object(payload.channel)?.id,
              object(payload.message)?.ts, action.action_id, action.action_ts, action.value]) : `envelope:${frame.envelope_id}`;
        if (this.duplicate(key)) return;
        const envelope = { ...frame, payload } as SlackEnvelope;
        void Promise.resolve().then(() => this.running ? this.handler(envelope) : undefined).catch(() => this.report());
      });
    });
  }

  private duplicate(key: string): boolean {
    const now = Date.now();
    for (const [id, at] of this.seen) {
      if (now - at < 3_600_000) break;
      this.seen.delete(id);
    }
    if (this.seen.has(key)) return true;
    this.seen.set(key, now);
    if (this.seen.size > 10_000) this.seen.delete(this.seen.keys().next().value!);
    return false;
  }
  private scheduleReconnect(error: unknown) {
    if (!this.running || this.reconnectTimer) return;
    const maxAttempts = Math.min(20, Math.max(0, this.options.maxReconnectAttempts ?? 8));
    if (this.retries >= maxAttempts || error instanceof SlackApiError && (terminalErrors.has(error.code) || (error.retryAfterMs ?? 0) > 300_000)) {
      this.running = false;
      this.currentStatus = 'failed';
      this.report();
      return;
    }
    const base = Math.max(1, this.options.reconnectBaseMs ?? 1000);
    const max = Math.min(30_000, Math.max(base, this.options.reconnectMaxMs ?? 30_000));
    const jitter = Math.min(1, Math.max(0, (this.options.random ?? Math.random)()));
    const delay = Math.max(Math.min(max, base * 2 ** this.retries * (1 + jitter * 0.2)), error instanceof SlackApiError ? error.retryAfterMs ?? 0 : 0);
    this.retries++;
    this.currentStatus = 'reconnecting';
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (!this.running) return;
      void this.connect().catch(error => { this.report(); this.scheduleReconnect(error); });
    }, delay);
  }
}
