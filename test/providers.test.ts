import assert from 'node:assert/strict';
import { beforeEach, test, type TestContext } from 'node:test';
import { getProviderStatus, searchWeb, synthesizeSpeech, transcribeAudio } from '../src/providers.js';

const OPENAI_KEY = 'test-openai-secret-never-sent';
const EXA_KEY = 'test-exa-secret-never-sent';
const RAW_ERROR = 'private-provider-payload-and-account-detail';
const environment = ['OPENAI_API_KEY', 'EXA_API_KEY', 'OPENAI_TRANSCRIPTION_MODEL', 'OPENAI_TTS_MODEL',
  'PROVIDER_TIMEOUT_MS', 'OPENAI_BASE_URL', 'OPENAI_LOG'];

beforeEach(t => {
  if (!('mock' in t)) throw new Error('Provider tests require a test context.');
  const original = new Map(environment.map(name => [name, process.env[name]]));
  for (const name of environment) delete process.env[name];
  // Even a misconfigured test must never fall through to a live provider.
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network request in provider test'); });
  t.after(() => {
    for (const [name, value] of original) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
});

function safeFailure(code: string, status: number, pattern?: RegExp): (error: unknown) => boolean {
  return error => {
    assert.ok(error instanceof Error);
    assert.equal((error as Error & { code: string }).code, code);
    assert.equal((error as Error & { status: number }).status, status);
    if (pattern) assert.match(error.message, pattern);
    for (const secret of [OPENAI_KEY, EXA_KEY, RAW_ERROR]) {
      assert.ok(!`${error.stack} ${JSON.stringify(error)}`.includes(secret));
    }
    assert.equal(error.cause, undefined);
    return true;
  };
}

test('status reports current configuration only and never probes or exposes keys', t => {
  const fetchMock = t.mock.method(globalThis, 'fetch');
  assert.deepEqual(getProviderStatus(), { agents: false, voice: false, search: false });
  process.env.OPENAI_API_KEY = `  ${OPENAI_KEY}  `;
  process.env.EXA_API_KEY = '   ';
  assert.deepEqual(getProviderStatus(), { agents: true, voice: true, search: false });
  process.env.EXA_API_KEY = EXA_KEY;
  assert.deepEqual(getProviderStatus(), { agents: true, voice: true, search: true });
  delete process.env.OPENAI_API_KEY;
  assert.deepEqual(getProviderStatus(), { agents: false, voice: false, search: true });
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('missing credentials fail explicitly without a network call', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch');
  await assert.rejects(searchWeb('a walk', 'Dubai Marina'), safeFailure('PROVIDER_NOT_CONFIGURED', 503, /EXA_API_KEY/));
  await assert.rejects(transcribeAudio(Buffer.from('audio'), 'voice.webm', 'audio/webm'), safeFailure('PROVIDER_NOT_CONFIGURED', 503, /OPENAI_API_KEY/));
  await assert.rejects(synthesizeSpeech('A short break.', 'health'), safeFailure('PROVIDER_NOT_CONFIGURED', 503, /OPENAI_API_KEY/));
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('Exa uses the neighborhood, documented native request, bounded sources and stable IDs', async t => {
  process.env.EXA_API_KEY = EXA_KEY;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    assert.equal(String(input), 'https://api.exa.ai/search');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${EXA_KEY}`);
    assert.deepEqual(JSON.parse(String(init?.body)), {
      query: 'quiet walking routes in Dubai Marina', type: 'auto', numResults: 5,
      contents: { text: { maxCharacters: 1000 } },
    });
    assert.ok(init?.signal instanceof AbortSignal);
    return Response.json({ results: [
      { url: 'https://example.com/walk#map', title: '  Marina\nroute ', text: 'A'.repeat(1500), address: 'Unverified field', openingHours: 'Always open' },
      { url: 'https://example.com/walk#another', title: 'Duplicate', text: 'Duplicate' },
      ...Array.from({ length: 8 }, (_, index) => ({ url: `https://example.com/route/${index}`, title: `Route ${index}`, text: 'Retrieved excerpt.' })),
    ], raw: RAW_ERROR });
  });
  const sources = await searchWeb(' quiet walking routes ', ' Dubai Marina ');
  assert.equal(sources.length, 5);
  assert.deepEqual(Object.keys(sources[0]!).sort(), ['id', 'title', 'url', 'snippet'].sort());
  assert.equal(sources[0]!.url, 'https://example.com/walk');
  assert.equal(sources[0]!.title, 'Marina route');
  assert.equal(sources[0]!.snippet.length, 1000);
  assert.ok(sources.every(source => source.snippet.length <= 1000));
  assert.equal(sources[0]!.address, undefined);
  assert.ok(!JSON.stringify(sources).includes(RAW_ERROR));
  const again = await searchWeb('quiet walking routes', 'Dubai Marina');
  assert.equal(sources[0]!.id, again[0]!.id);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test('search filters unsafe URLs and malformed entries, using actual excerpts only', async t => {
  process.env.EXA_API_KEY = EXA_KEY;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ results: [
    null, false, [], { url: 5 }, { url: 'javascript:alert(1)' }, { url: '//example.com/path' },
    { url: 'data:text/html,bad' }, { url: 'ftp://example.com' }, { url: 'http://user:pass@example.com' },
    { url: 'https://example.com/\nunsafe' }, { url: 'https://example.com\\other' }, { url: 'https://' },
    { url: ' https://example.com/good ', title: null, text: {}, highlights: ['Real\nexcerpt', 123, null, 'B'.repeat(1100)], summary: 'Invented summary' },
    { url: 'http://example.org/other', title: 'Other', summary: 'No source text was retrieved' },
  ] }));
  const sources = await searchWeb('walks');
  assert.equal(sources.length, 2);
  assert.equal(sources[0]!.url, 'https://example.com/good');
  assert.equal(sources[0]!.title, 'example.com');
  assert.match(sources[0]!.snippet, /^Real excerpt B/);
  assert.equal(sources[0]!.snippet.length, 1000);
  assert.equal(sources[1]!.snippet, '');
  assert.ok(!JSON.stringify(sources).includes('Invented'));
});

test('empty search results remain empty, and malformed payloads are safe failures', async t => {
  process.env.EXA_API_KEY = EXA_KEY;
  let payload: unknown = { results: [] };
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  assert.deepEqual(await searchWeb('walks'), []);
  for (payload of [null, [], {}, { results: {} }, { error: RAW_ERROR }]) {
    await assert.rejects(searchWeb('walks'), safeFailure('PROVIDER_INVALID_RESPONSE', 502));
  }
});

test('search input validation happens before fetching', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch');
  for (const [query, area] of [[' ', undefined], ['x'.repeat(2001), undefined], ['walks', 'x'.repeat(201)], [null, undefined], ['walks', 42]]) {
    await assert.rejects(searchWeb(query as string, area as string | undefined), safeFailure('INVALID_INPUT', 400));
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('Exa HTTP failures expose only safe status and never retry or reveal raw payloads', async t => {
  process.env.EXA_API_KEY = EXA_KEY;
  let status = 401;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: `${RAW_ERROR} ${EXA_KEY}` }, { status }));
  for (status of [401, 403, 429, 500]) {
    await assert.rejects(searchWeb('walks'), safeFailure('PROVIDER_HTTP_ERROR', status === 429 ? 429 : 502, new RegExp(`HTTP ${status}`)));
  }
  assert.equal(fetchMock.mock.callCount(), 4);
});

test('search network and JSON parse errors cannot leak provider details', async t => {
  process.env.EXA_API_KEY = EXA_KEY;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError(`${RAW_ERROR} ${EXA_KEY}`); });
  await assert.rejects(searchWeb('walks'), safeFailure('PROVIDER_CONNECTION_ERROR', 502));
  fetchMock.mock.mockImplementation(async () => new Response(`${RAW_ERROR} ${EXA_KEY}`));
  await assert.rejects(searchWeb('walks'), safeFailure('PROVIDER_INVALID_RESPONSE', 502));
});

test('search response size is bounded and an oversized body is cancelled', async t => {
  process.env.EXA_API_KEY = EXA_KEY;
  let cancelled = false;
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); },
    cancel() { cancelled = true; },
  })));
  await assert.rejects(searchWeb('walks'), safeFailure('PROVIDER_INVALID_RESPONSE', 502));
  assert.ok(cancelled);
});

async function assertDeadline(t: TestContext, operation: () => Promise<unknown>, body?: boolean) {
  process.env.PROVIDER_TIMEOUT_MS = '1000';
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal: AbortSignal | null | undefined;
  let cancelled = false;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    // The SDK probes native FormData support using a local data URL, without network I/O.
    if (String(_input) === 'data:,') return new Response();
    signal = init?.signal;
    if (!body) return new Promise<Response>(() => {});
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); },
      cancel() { cancelled = true; },
    }), { headers: { 'content-type': 'audio/mpeg' } });
  });
  const outcome = assert.rejects(operation(), safeFailure('PROVIDER_TIMEOUT', 504));
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(1000);
  await outcome;
  assert.equal(fetchMock.mock.calls.filter(call => String(call.arguments[0]) !== 'data:,').length, 1);
  assert.ok(signal?.aborted);
  if (body) assert.ok(cancelled);
}

test('search deadline covers unresponsive fetch and safely aborts', async t => {
  process.env.EXA_API_KEY = EXA_KEY;
  await assertDeadline(t, () => searchWeb('walks'));
});

test('actual OpenAI SDK sends transcription bytes as a file and returns transcript text', async t => {
  process.env.OPENAI_API_KEY = OPENAI_KEY;
  process.env.OPENAI_BASE_URL = 'https://untrusted.example';
  const bytes = Buffer.from([1, 2, 3, 4, 255]);
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(input) === 'data:,') return new Response();
    assert.equal(String(input), 'https://api.openai.com/v1/audio/transcriptions');
    assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${OPENAI_KEY}`);
    const form = await new Response(init?.body, { headers: init?.headers }).formData();
    assert.equal(form.get('model'), 'gpt-4o-mini-transcribe');
    assert.equal(form.get('response_format'), 'json');
    const file = form.get('file');
    assert.ok(file instanceof File);
    assert.equal(file.name, 'voice.webm');
    assert.equal(file.type, 'audio/webm');
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
    return Response.json({ text: '  Move my walk to 6 pm.  ', usage: { private: RAW_ERROR } });
  });
  assert.equal(await transcribeAudio(bytes, '../../voice.webm', 'audio/webm;codecs=opus'), 'Move my walk to 6 pm.');
  assert.equal(fetchMock.mock.calls.filter(call => String(call.arguments[0]) !== 'data:,').length, 1);
});

test('transcription model override supports gpt-transcribe and normalizes browser filenames', async t => {
  process.env.OPENAI_API_KEY = OPENAI_KEY;
  process.env.OPENAI_TRANSCRIPTION_MODEL = 'gpt-transcribe';
  t.mock.method(globalThis, 'fetch', async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(_input) === 'data:,') return new Response();
    const form = await new Response(init?.body, { headers: init?.headers }).formData();
    assert.equal(form.get('model'), 'gpt-transcribe');
    assert.equal((form.get('file') as File).name, 'recording.m4a');
    assert.equal((form.get('file') as File).type, 'audio/mp4');
    return Response.json({ text: 'مرحبا', languages: [{ language: 'ar' }] });
  });
  assert.equal(await transcribeAudio(Buffer.from('audio'), 'blob', 'audio/mp4'), 'مرحبا');
});

test('audio upload rejects empty, oversized and unsupported input before network access', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch');
  await assert.rejects(transcribeAudio(Buffer.alloc(0), 'voice.webm', 'audio/webm'), safeFailure('INVALID_INPUT', 400));
  await assert.rejects(transcribeAudio(Buffer.alloc(10 * 1024 * 1024 + 1), 'voice.webm', 'audio/webm'), safeFailure('AUDIO_TOO_LARGE', 413));
  for (const mime of ['text/plain', 'application/octet-stream', '__proto__']) {
    await assert.rejects(transcribeAudio(Buffer.from('audio'), 'voice.webm', mime), safeFailure('UNSUPPORTED_AUDIO_TYPE', 415));
  }
  await assert.rejects(transcribeAudio(Buffer.from('audio'), '', 'audio/webm'), safeFailure('INVALID_INPUT', 400));
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('transcription rejects malformed provider data and distinguishes no speech', async t => {
  process.env.OPENAI_API_KEY = OPENAI_KEY;
  let payload: unknown;
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  for (payload of [null, {}, { text: 123 }, { text: 'x'.repeat(20_001) }]) {
    await assert.rejects(transcribeAudio(Buffer.from('audio'), 'voice.wav', 'audio/wav'), safeFailure('PROVIDER_INVALID_RESPONSE', 502));
  }
  payload = { text: ' ' };
  await assert.rejects(transcribeAudio(Buffer.from('audio'), 'voice.wav', 'audio/wav'), safeFailure('NO_SPEECH', 422));
});

test('actual SDK returns MP3 bytes using distinct documented coach voices and a model override', async t => {
  process.env.OPENAI_API_KEY = OPENAI_KEY;
  const bodies: Record<string, unknown>[] = [];
  const bytes = Buffer.from([73, 68, 51, 1, 2, 3]);
  t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    assert.equal(String(input), 'https://api.openai.com/v1/audio/speech');
    assert.equal(init?.redirect, 'error');
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } });
  });
  const health = await synthesizeSpeech(' Take a short break. ', 'health');
  assert.ok(Buffer.isBuffer(health));
  assert.deepEqual(health, bytes);
  process.env.OPENAI_TTS_MODEL = 'gpt-4o-mini-tts-2025-12-15';
  assert.deepEqual(await synthesizeSpeech('Practice your presentation.', 'career'), bytes);
  assert.deepEqual(bodies, [
    { model: 'gpt-4o-mini-tts', voice: 'coral', input: 'Take a short break.', response_format: 'mp3' },
    { model: 'gpt-4o-mini-tts-2025-12-15', voice: 'cedar', input: 'Practice your presentation.', response_format: 'mp3' },
  ]);
});

test('speech rejects empty, oversized and invalid coach input before fetching', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch');
  for (const text of ['', '  ', 'x'.repeat(2001), null]) {
    await assert.rejects(synthesizeSpeech(text as string, 'health'), safeFailure('INVALID_INPUT', 400));
  }
  await assert.rejects(synthesizeSpeech('A break.', 'other' as 'health'), safeFailure('INVALID_INPUT', 400));
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('speech rejects non-audio, empty and oversized provider responses', async t => {
  process.env.OPENAI_API_KEY = OPENAI_KEY;
  const replies = [
    () => Response.json({ error: RAW_ERROR }),
    () => new Response('', { headers: { 'Content-Type': 'audio/mpeg' } }),
    () => new Response('short', { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(10 * 1024 * 1024 + 1) } }),
  ];
  for (const reply of replies) {
    t.mock.method(globalThis, 'fetch', async () => reply());
    await assert.rejects(synthesizeSpeech('A break.', 'health'), safeFailure('PROVIDER_INVALID_RESPONSE', 502));
  }
});

test('OpenAI SDK HTTP failures are safe, do not retry and do not log provider payloads', async t => {
  process.env.OPENAI_API_KEY = OPENAI_KEY;
  process.env.OPENAI_LOG = 'debug';
  const logs: unknown[][] = [];
  for (const method of ['log', 'debug', 'info', 'warn', 'error'] as const) t.mock.method(console, method, (...args: unknown[]) => { logs.push(args); });
  let status = 401;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0]) => {
    if (String(input) === 'data:,') return new Response();
    return Response.json({ error: { message: `${RAW_ERROR} ${OPENAI_KEY}`, type: 'provider_error' } }, { status });
  });
  for (status of [401, 403, 429, 500]) {
    await assert.rejects(synthesizeSpeech('A break.', 'health'), safeFailure('PROVIDER_HTTP_ERROR', status === 429 ? 429 : 502, new RegExp(`HTTP ${status}`)));
  }
  await assert.rejects(transcribeAudio(Buffer.from('audio'), 'voice.wav', 'audio/wav'), safeFailure('PROVIDER_HTTP_ERROR', 502, /HTTP 500/));
  assert.equal(fetchMock.mock.calls.filter(call => String(call.arguments[0]) !== 'data:,').length, 5);
  assert.equal(logs.length, 0);
});

test('OpenAI network failures are safe and make one attempt', async t => {
  process.env.OPENAI_API_KEY = OPENAI_KEY;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError(`${RAW_ERROR} ${OPENAI_KEY}`); });
  await assert.rejects(synthesizeSpeech('A break.', 'career'), safeFailure('PROVIDER_CONNECTION_ERROR', 502));
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('speech deadline includes the response body and cancels stalled streaming audio', async t => {
  process.env.OPENAI_API_KEY = OPENAI_KEY;
  await assertDeadline(t, () => synthesizeSpeech('A break.', 'health'), true);
});

test('transcription deadline aborts the SDK request without retrying', async t => {
  process.env.OPENAI_API_KEY = OPENAI_KEY;
  await assertDeadline(t, () => transcribeAudio(Buffer.from('audio'), 'voice.wav', 'audio/wav'));
});


test('exhausted OpenAI credits produce a useful billing error without exposing provider details or retrying', async t => {
  process.env.OPENAI_API_KEY = OPENAI_KEY;
  const mocked = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({error:{message:RAW_ERROR,type:'insufficient_quota',code:'credit_balance_exhausted'}}),{status:429,headers:{'content-type':'application/json'}}));
  await assert.rejects(synthesizeSpeech('Hello.', 'health'), safeFailure('OPENAI_CREDITS_EXHAUSTED',429,/credits are exhausted/));
  assert.equal(mocked.mock.callCount(),1);
});
