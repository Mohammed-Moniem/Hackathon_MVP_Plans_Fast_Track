import assert from 'node:assert/strict';
import { beforeEach, test, type TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import { linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeImage, generateMealImage, getGeneratedImage } from '../src/mentor-media.js';
import type { VisionAnalysis } from '../src/ecosystem-types.js';

const KEY = 'test-openai-secret-never-sent';
const PRIVATE = 'private-provider-payload-and-account-details';
const PROMPT = 'private-meal-description';
const MAX_BYTES = 6 * 1024 * 1024;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=', 'base64');
// Signature/framing fixtures; format decoding remains the provider's responsibility.
const JPEG = Buffer.from([255, 216, 255, 254, 0, 2, 255, 217]);
const WEBP = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
const RECEIPT: VisionAnalysis = {
  summary: 'A receipt with one unreadable line.', merchant: 'Local Market', total: 12.5,
  currency: 'AED', items: [{ name: 'Rice', amount: 12.5 }, { name: 'Unreadable item', amount: null }],
  uncertainties: ['The second line amount is unreadable.'],
};
const environment = ['OPENAI_API_KEY', 'OPENAI_VISION_MODEL', 'OPENAI_IMAGE_MODEL', 'PROVIDER_TIMEOUT_MS', 'OPENAI_BASE_URL', 'OPENAI_LOG'];

beforeEach(t => {
  if (!('mock' in t)) throw new Error('Media tests require a test context.');
  const original = new Map(environment.map(name => [name, process.env[name]]));
  for (const name of environment) delete process.env[name];
  const cwd = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), 'mentor-media-test-'));
  process.chdir(directory);
  // Tests can never use a real credential, contact a provider, or write project images.
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network request in media test'); });
  t.after(() => {
    process.chdir(cwd);
    rmSync(directory, { recursive: true, force: true });
    for (const [name, value] of original) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
});

function safeFailure(code: string, status: number) {
  return (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'ProviderError');
    assert.equal((error as Error & { code: string }).code, code);
    assert.equal((error as Error & { status: number }).status, status);
    const exposed = `${error.stack} ${JSON.stringify(error)}`;
    for (const secret of [KEY, PRIVATE, PROMPT]) assert.ok(!exposed.includes(secret));
    assert.equal(error.cause, undefined);
    return true;
  };
}

function visionResponse(value: unknown = RECEIPT, status = 'completed', refusal = false): Response {
  return Response.json({
    id: 'resp_test', object: 'response', status,
    output: [{ id: 'msg_test', type: 'message', role: 'assistant', status: 'completed', content: refusal
      ? [{ type: 'refusal', refusal: `${PRIVATE} ${KEY}` }]
      : [{ type: 'output_text', text: JSON.stringify(value), annotations: [] }] }],
  });
}
const imageResponse = (buffer = PNG) => Response.json({ created: 1, data: [{ b64_json: buffer.toString('base64'), revised_prompt: PRIVATE }] });
function storage(): string { const path = join(process.cwd(), '.mentor', 'images'); mkdirSync(path, { recursive: true }); return path; }

test('missing key fails both provider operations without sending or storing anything', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch');
  await assert.rejects(analyzeImage(PNG, 'image/png'), safeFailure('PROVIDER_NOT_CONFIGURED', 503));
  await assert.rejects(generateMealImage(PROMPT), safeFailure('PROVIDER_NOT_CONFIGURED', 503));
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.deepEqual(readdirSync('.'), []);
});

test('image input validates buffer bounds, exact MIME allowlist and matching signatures before fetch', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch');
  for (const buffer of [Buffer.alloc(0), null, new Uint8Array(PNG), 'image']) {
    await assert.rejects(analyzeImage(buffer as Buffer, 'image/png'), safeFailure('INVALID_INPUT', 400));
  }
  await assert.rejects(analyzeImage(Buffer.alloc(MAX_BYTES + 1), 'image/png'), safeFailure('IMAGE_TOO_LARGE', 413));
  for (const mime of ['image/gif', 'image/svg+xml', 'text/html', 'application/octet-stream', '__proto__', 'image/png;name=x', null]) {
    await assert.rejects(analyzeImage(PNG, mime as string), safeFailure('UNSUPPORTED_IMAGE_TYPE', 415));
  }
  for (const [buffer, mime] of [[PNG, 'image/jpeg'], [JPEG, 'image/png'], [PNG, 'image/webp'],
    [Buffer.from('<svg onload="alert(1)"/>'), 'image/png'], [PNG.subarray(0, 8), 'image/png'],
    [PNG.subarray(0, PNG.length - 1), 'image/png'], [JPEG.subarray(0, 3), 'image/jpeg'],
    [WEBP.subarray(0, 12), 'image/webp']] as const) {
    await assert.rejects(analyzeImage(buffer, mime), safeFailure('INVALID_IMAGE', 400));
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('forged PNG chunk lengths and WebP container lengths are rejected safely', async () => {
  const png = Buffer.from(PNG); png.writeUInt32BE(0xffffffff, 33);
  const webp = Buffer.from(WEBP); webp.writeUInt32LE(0xffffffff, 4);
  const chunk = Buffer.from(WEBP); chunk.writeUInt32LE(0xffffffff, 16);
  await assert.rejects(analyzeImage(png, 'image/png'), safeFailure('INVALID_IMAGE', 400));
  for (const bytes of [webp, chunk]) await assert.rejects(analyzeImage(bytes, 'image/webp'), safeFailure('INVALID_IMAGE', 400));
});

test('both prompt boundaries reject nonstrings and more than 2000 characters before network access', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch');
  for (const prompt of [null, 42, {}, 'x'.repeat(2001)]) {
    await assert.rejects(analyzeImage(PNG, 'image/png', prompt as string), safeFailure('INVALID_INPUT', 400));
    await assert.rejects(generateMealImage(prompt as string), safeFailure('INVALID_INPUT', 400));
  }
  for (const prompt of ['', '   ', undefined]) await assert.rejects(generateMealImage(prompt as string), safeFailure('INVALID_INPUT', 400));
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('real SDK sends Responses input_image and strict nullable receipt schema to the pinned official host', async t => {
  process.env.OPENAI_API_KEY = ` ${KEY} `;
  process.env.OPENAI_BASE_URL = 'https://untrusted.example';
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    assert.equal(String(input), 'https://api.openai.com/v1/responses');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal instanceof AbortSignal);
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${KEY}`);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'gpt-4.1-mini');
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 4000);
    assert.equal(body.tools, undefined);
    assert.deepEqual(body.input, [{ role: 'user', content: [
      { type: 'input_text', text: 'Read this receipt.' },
      { type: 'input_image', image_url: `data:image/png;base64,${PNG.toString('base64')}`, detail: 'high' },
    ] }]);
    assert.match(body.instructions, /untrusted data/);
    assert.match(body.instructions, /Use null/);
    assert.match(body.instructions, /uncertainties/);
    const format = body.text.format;
    assert.equal(format.type, 'json_schema');
    assert.equal(format.strict, true);
    assert.equal(format.schema.additionalProperties, false);
    assert.deepEqual([...format.schema.required].sort(), ['summary', 'merchant', 'total', 'currency', 'items', 'uncertainties'].sort());
    assert.match(JSON.stringify(format.schema.properties.total), /null/);
    return visionResponse();
  });
  assert.deepEqual(await analyzeImage(PNG, ' IMAGE/PNG ', ' Read this receipt. '), RECEIPT);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(readdirSync('.'), []);
});

test('JPEG/WebP signatures are accepted; non-receipt unknowns stay null without coercion or invention', async t => {
  process.env.OPENAI_API_KEY = KEY;
  process.env.OPENAI_VISION_MODEL = 'gpt-4.1';
  const unknowns: VisionAnalysis = { summary: 'A plate with unreadable labels.', merchant: null, total: null, currency: null,
    items: [{ name: 'Visible plate', amount: null }], uncertainties: ['Ingredients cannot be verified from appearance.'] };
  let mediaType = 'image/jpeg';
  t.mock.method(globalThis, 'fetch', async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'gpt-4.1');
    assert.ok(body.input[0].content[1].image_url.startsWith(`data:${mediaType};base64,`));
    assert.ok(body.input[0].content[0].text.length > 0);
    return visionResponse(unknowns);
  });
  assert.deepEqual(await analyzeImage(JPEG, mediaType), unknowns);
  mediaType = 'image/webp';
  assert.deepEqual(await analyzeImage(WEBP, mediaType, ''), unknowns);
});

test('exactly 6 MiB uploads and 2000-character user prompts are permitted', async t => {
  process.env.OPENAI_API_KEY = KEY;
  const jpeg = Buffer.alloc(MAX_BYTES); JPEG.copy(jpeg); jpeg[MAX_BYTES - 2] = 255; jpeg[MAX_BYTES - 1] = 217;
  t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0]) => String(input).endsWith('/responses') ? visionResponse() : imageResponse());
  assert.deepEqual(await analyzeImage(jpeg, 'image/jpeg', 'a'.repeat(2000)), RECEIPT);
  assert.equal((await generateMealImage('a'.repeat(2000))).prompt.length, 2000);
});

test('receipt values preserve printed zero and negative adjustments', async t => {
  process.env.OPENAI_API_KEY = KEY;
  const receipt = { ...RECEIPT, total: 0, items: [{ name: 'Discount', amount: -12.5 }] };
  t.mock.method(globalThis, 'fetch', async () => visionResponse(receipt));
  assert.deepEqual(await analyzeImage(PNG, 'image/png'), receipt);
  receipt.total = -12.5;
  assert.deepEqual(await analyzeImage(PNG, 'image/png'), receipt);
});

test('structured output rejects malformed fields, unknown properties and unbounded extraction', async t => {
  process.env.OPENAI_API_KEY = KEY;
  let payload: unknown;
  t.mock.method(globalThis, 'fetch', async () => visionResponse(payload));
  for (payload of [null, [], {}, { ...RECEIPT, total: '12.50' }, { ...RECEIPT, total: undefined },
    { ...RECEIPT, merchant: '' }, { ...RECEIPT, summary: ' ' }, { ...RECEIPT, currency: 42 },
    { ...RECEIPT, extra: PRIVATE }, { ...RECEIPT, items: [{ name: 'Rice' }] },
    { ...RECEIPT, items: Array.from({ length: 101 }, () => ({ name: 'Item', amount: null })) },
    { ...RECEIPT, uncertainties: [''] }, { ...RECEIPT, uncertainties: Array(31).fill('Unclear') },
    { ...RECEIPT, summary: 'x'.repeat(2001) }]) {
    await assert.rejects(analyzeImage(PNG, 'image/png'), safeFailure('PROVIDER_INVALID_RESPONSE', 502));
  }
});

test('incomplete and refused Responses are never presented as successful extraction', async t => {
  process.env.OPENAI_API_KEY = KEY;
  let status = 'incomplete', refusal = false;
  t.mock.method(globalThis, 'fetch', async () => visionResponse(RECEIPT, status, refusal));
  await assert.rejects(analyzeImage(PNG, 'image/png'), safeFailure('PROVIDER_INVALID_RESPONSE', 502));
  status = 'completed'; refusal = true;
  await assert.rejects(analyzeImage(PNG, 'image/png'), safeFailure('PROVIDER_INVALID_RESPONSE', 502));
});

test('meal generation uses one low-quality 1024 PNG and returns a retrievable private UUID file', async t => {
  process.env.OPENAI_API_KEY = KEY;
  process.env.OPENAI_BASE_URL = 'https://untrusted.example';
  process.env.OPENAI_LOG = 'debug';
  const logs: unknown[][] = [];
  for (const method of ['log', 'debug', 'info', 'warn', 'error'] as const) t.mock.method(console, method, (...args: unknown[]) => { logs.push(args); });
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    assert.equal(String(input), 'https://api.openai.com/v1/images/generations');
    assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${KEY}`);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'gpt-image-1-mini');
    assert.equal(body.n, 1); assert.equal(body.quality, 'low'); assert.equal(body.size, '1024x1024');
    assert.equal(body.output_format, 'png'); assert.equal(body.response_format, undefined);
    assert.ok(body.prompt.endsWith(PROMPT));
    assert.match(body.prompt, /meal illustration/);
    return imageResponse();
  });
  const meal = await generateMealImage(` ${PROMPT} `);
  assert.match(meal.url, /^\/api\/ecosystem\/images\/[0-9a-f-]{36}$/);
  assert.equal(meal.prompt, PROMPT);
  assert.match(meal.caption, /AI-generated meal illustration/);
  assert.match(meal.caption, /not a photograph or nutrition facts/);
  assert.equal(new Date(meal.generatedAt).toISOString(), meal.generatedAt);
  assert.ok(!JSON.stringify(meal).includes(PRIVATE));
  const id = meal.url.split('/').at(-1)!;
  const file = join('.mentor', 'images', `${id}.png`);
  assert.deepEqual(readFileSync(file), PNG);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(statSync('.mentor/images').mode & 0o777, 0o700);
  assert.deepEqual(readdirSync('.mentor/images'), [`${id}.png`]);
  assert.deepEqual(await getGeneratedImage(id), { buffer: PNG, mime: 'image/png' });
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(logs, []);
});

test('meal image model override retains hard size/quality/count caps and files have distinct IDs', async t => {
  process.env.OPENAI_API_KEY = KEY;
  process.env.OPENAI_IMAGE_MODEL = 'gpt-image-1.5';
  t.mock.method(globalThis, 'fetch', async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'gpt-image-1.5');
    assert.equal(body.n, 1); assert.equal(body.quality, 'low'); assert.equal(body.size, '1024x1024');
    return imageResponse();
  });
  const first = await generateMealImage('rice');
  const second = await generateMealImage('beans');
  assert.notEqual(first.url, second.url);
  assert.equal(readdirSync('.mentor/images').length, 2);
});

test('Images API malformed, URL-only, multiple, non-PNG and oversized-dimension outputs are rejected', async t => {
  process.env.OPENAI_API_KEY = KEY;
  let payload: unknown;
  const tooWide = Buffer.from(PNG); tooWide.writeUInt32BE(1025, 16);
  const tooTall = Buffer.from(PNG); tooTall.writeUInt32BE(1025, 20);
  const zeroWidth = Buffer.from(PNG); zeroWidth.writeUInt32BE(0, 16);
  const valid = PNG.toString('base64');
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  const replies = [{}, { data: [] }, { data: [{ url: 'https://untrusted.example/private.png' }] },
    { data: [{ b64_json: valid }, { b64_json: valid }] }, ...['', '%%%%', ` ${valid}`, `${valid}junk`,
      JPEG.toString('base64'), PNG.subarray(0, 8).toString('base64'), tooWide.toString('base64'), tooTall.toString('base64'), zeroWidth.toString('base64')]
      .map(b64_json => ({ data: [{ b64_json }] }))];
  for (payload of replies) await assert.rejects(generateMealImage(PROMPT), safeFailure('PROVIDER_INVALID_RESPONSE', 502));
  assert.equal(fetchMock.mock.callCount(), replies.length);
  assert.deepEqual(readdirSync('.mentor/images'), []);
});

test('HTTP failures never log prompts or upstream secrets and make exactly one attempt', async t => {
  process.env.OPENAI_API_KEY = KEY; process.env.OPENAI_LOG = 'debug';
  const logs: unknown[][] = [];
  for (const method of ['log', 'debug', 'info', 'warn', 'error'] as const) t.mock.method(console, method, (...args: unknown[]) => { logs.push(args); });
  let status = 401;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: `${PRIVATE} ${KEY} ${PROMPT}` } }, { status }));
  for (status of [401, 403, 429, 500, 503]) {
    for (const operation of [() => analyzeImage(PNG, 'image/png', PROMPT), () => generateMealImage(PROMPT)]) {
      await assert.rejects(operation(), safeFailure('PROVIDER_HTTP_ERROR', status === 429 ? 429 : 502));
    }
  }
  assert.equal(fetchMock.mock.callCount(), 10);
  assert.deepEqual(logs, []);
});

test('network failures are stable and redacted without retries', async t => {
  process.env.OPENAI_API_KEY = KEY;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error(`${PRIVATE} ${KEY} ${PROMPT}`); });
  await assert.rejects(analyzeImage(PNG, 'image/png', PROMPT), safeFailure('PROVIDER_CONNECTION_ERROR', 502));
  await assert.rejects(generateMealImage(PROMPT), safeFailure('PROVIDER_CONNECTION_ERROR', 502));
  assert.equal(fetchMock.mock.callCount(), 2);
});

test('response bounds cancel oversized advertised and streaming bodies before SDK parsing', async t => {
  process.env.OPENAI_API_KEY = KEY;
  for (const advertised of [true, false]) {
    let cancelled = false;
    t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
      start(controller) { if (!advertised) controller.enqueue(new Uint8Array(256 * 1024 + 1)); },
      cancel() { cancelled = true; },
    }), { headers: advertised ? { 'content-length': String(256 * 1024 + 1) } : undefined }));
    await assert.rejects(analyzeImage(PNG, 'image/png'), safeFailure('PROVIDER_INVALID_RESPONSE', 502));
    assert.ok(cancelled);
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('small', { headers: { 'content-length': String(16 * 1024 * 1024) } }));
  await assert.rejects(generateMealImage(PROMPT), safeFailure('PROVIDER_INVALID_RESPONSE', 502));
});

async function deadlineTest(t: TestContext, operation: () => Promise<unknown>, options: { body?: boolean; configured?: string; ms?: number } = {}) {
  process.env.OPENAI_API_KEY = KEY;
  process.env.PROVIDER_TIMEOUT_MS = options.configured ?? '1000';
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal: AbortSignal | undefined | null, cancelled = false;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    signal = init?.signal;
    if (!options.body) return new Promise<Response>(() => {});
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('{')); },
      cancel() { cancelled = true; },
    }), { headers: { 'content-type': 'application/json' } });
  });
  let settled = false;
  const rejected = assert.rejects(operation(), safeFailure('PROVIDER_TIMEOUT', 504)).then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick((options.ms ?? 1000) - 1);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  t.mock.timers.tick(1);
  await rejected;
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.ok(signal?.aborted);
  if (options.body) assert.ok(cancelled);
}

test('vision deadline aborts an unresponsive fetch', async t => deadlineTest(t, () => analyzeImage(PNG, 'image/png')));
test('vision deadline covers body consumption after headers', async t => deadlineTest(t, () => analyzeImage(PNG, 'image/png'), { body: true }));
test('generation deadline covers body consumption after headers', async t => deadlineTest(t, () => generateMealImage(PROMPT), { body: true }));
test('configured timeouts above 90 seconds are capped', async t => deadlineTest(t, () => generateMealImage(PROMPT), { configured: '99999999', ms: 90_000 }));
test('invalid timeout values use the bounded default', async t => deadlineTest(t, () => analyzeImage(PNG, 'image/png'), { configured: 'Infinity', ms: 60_000 }));

test('an image response arriving after timeout cannot persist a file', async t => {
  process.env.OPENAI_API_KEY = KEY; process.env.PROVIDER_TIMEOUT_MS = '1000';
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish!: (response: Response) => void;
  t.mock.method(globalThis, 'fetch', async () => new Promise<Response>(resolve => { finish = resolve; }));
  const rejected = assert.rejects(generateMealImage(PROMPT), safeFailure('PROVIDER_TIMEOUT', 504));
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(1000);
  await rejected;
  finish(imageResponse());
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(readdirSync('.mentor/images'), []);
});

test('GET rejects malicious/non-UUID IDs, missing files and never contacts a provider', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch');
  for (const id of ['', '../state', '../../.env', '%2e%2e%2f.env', '/etc/passwd', '..\\.env', 'data:image/png;base64,x',
    `${randomUUID()}.png`, `${randomUUID()}?download=1`, `${randomUUID()}\0`, randomUUID().toUpperCase(), '__proto__', null, 'x'.repeat(5000), randomUUID()]) {
    await assert.rejects(getGeneratedImage(id as string), safeFailure('IMAGE_NOT_FOUND', 404));
  }
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.deepEqual(readdirSync('.'), []);
});

test('GET only serves bounded generated PNG files, rejecting corrupt, oversized and non-file paths', async () => {
  const directory = storage();
  for (const bytes of [Buffer.alloc(0), JPEG, Buffer.from(PRIVATE), PNG.subarray(0, 8), Buffer.alloc(MAX_BYTES + 1)]) {
    const id = randomUUID(); writeFileSync(join(directory, `${id}.png`), bytes);
    await assert.rejects(getGeneratedImage(id), safeFailure('IMAGE_NOT_FOUND', 404));
  }
  const id = randomUUID(); mkdirSync(join(directory, `${id}.png`));
  await assert.rejects(getGeneratedImage(id), safeFailure('IMAGE_NOT_FOUND', 404));
});

test('GET rejects symlinks and hardlinks even when they point at valid PNGs', async () => {
  const directory = storage(); const outside = join(process.cwd(), 'outside.png'); writeFileSync(outside, PNG);
  const symlink = randomUUID(), hardlink = randomUUID();
  symlinkSync(outside, join(directory, `${symlink}.png`));
  linkSync(outside, join(directory, `${hardlink}.png`));
  for (const id of [symlink, hardlink]) await assert.rejects(getGeneratedImage(id), safeFailure('IMAGE_NOT_FOUND', 404));
  assert.deepEqual(readFileSync(outside), PNG);
});

test('symlinked image storage is rejected before a paid request and cannot be read through GET', async t => {
  process.env.OPENAI_API_KEY = KEY;
  mkdirSync('.mentor'); mkdirSync('outside'); symlinkSync(join(process.cwd(), 'outside'), '.mentor/images');
  const id = randomUUID(); writeFileSync(join('outside', `${id}.png`), PNG);
  const fetchMock = t.mock.method(globalThis, 'fetch');
  await assert.rejects(generateMealImage(PROMPT), safeFailure('IMAGE_STORAGE_ERROR', 503));
  await assert.rejects(getGeneratedImage(id), safeFailure('IMAGE_NOT_FOUND', 404));
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('symlinked .mentor parent is rejected for both operations', async t => {
  process.env.OPENAI_API_KEY = KEY;
  mkdirSync('outside/images', { recursive: true }); symlinkSync(join(process.cwd(), 'outside'), '.mentor');
  const id = randomUUID(); writeFileSync(join('outside/images', `${id}.png`), PNG);
  const fetchMock = t.mock.method(globalThis, 'fetch');
  await assert.rejects(generateMealImage(PROMPT), safeFailure('IMAGE_STORAGE_ERROR', 503));
  await assert.rejects(getGeneratedImage(id), safeFailure('IMAGE_NOT_FOUND', 404));
  assert.equal(fetchMock.mock.callCount(), 0);
});
