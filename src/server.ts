import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import OpenAI from 'openai';
import { z } from 'zod';
import { Store } from './store.js';
import { Engine, type Sender } from './engine.js';
import { DealAgent, safeError } from './agent.js';
import { type Mode } from './domain.js';
import { evidence, supplierPatterns, firstMessage, secondMessage, initialOffer, counteroffer, secondOffer } from './fixtures.js';
import { MentorService } from './mentor.js';
import { EcosystemService } from './ecosystem.js';
import { analyzeImage, generateMealImage, getGeneratedImage } from './mentor-media.js';
import { getProviderStatus, transcribeAudio, synthesizeSpeech } from './providers.js';

config({ path: ['.env.local', '.env'] });
const port = Number(process.env.PORT || 3210);
const host = '127.0.0.1';
const webRoot = resolve('web');
const allowedHosts = new Set([`${host}:${port}`, `localhost:${port}`]);
let dealMode: Mode = 'replay';
let store = new Store();
let engine = new Engine(store, { CFO: ['LOCAL-DEMO'], 'Procurement Director': ['LOCAL-DEMO'] });
let dealBusy = false;
let mentorBusy = false;
let dealError: string | undefined;
const mentor = new MentorService();
const ecosystem = new EcosystemService();
const mediaJobs = new Set<string>();
async function boundedJob<T>(name:string, job:()=>Promise<T>):Promise<T> {
  if(mediaJobs.has(name)) throw new HttpError(409, `A ${name} request is already running. Wait for it to finish.`);
  mediaJobs.add(name);try{return await job();}finally{mediaJobs.delete(name);}
}
const replayReceipts = new Map<string, { messageTs: string; channel: string }>();
const replaySender: Sender = {
  async send(p) {
    if (p.mode !== 'replay') throw new Error('Replay transport cannot deliver live proposals.');
    const receipt = { messageTs: `replay-${randomUUID()}`, channel: engine.thread(p.threadKey).channel };
    replayReceipts.set(p.id, receipt);
    return receipt;
  },
  async find(p) { return replayReceipts.get(p.id) ?? null; },
};
const latestThread = () => Object.values(engine.state.threads).at(-1) ?? null;
function dealState() {
  const proposals = Object.values(engine.state.proposals);
  return { mode: dealMode, capabilities: { agents: getProviderStatus().agents, slack: false },
    thread: latestThread(), proposal: proposals.at(-1) ?? null, proposals,
    evidence, patterns: supplierPatterns(), audit: engine.state.audit,
    busy: dealBusy, error: dealError, delivery: 'Browser replay simulates delivery. Live supplier delivery requires the separately configured Slack bot.',
    examples: { firstMessage, secondMessage } };
}
function resetDeal(mode: Mode) {
  dealMode = mode;
  store = new Store();
  engine = new Engine(store, { CFO: ['LOCAL-DEMO'], 'Procurement Director': ['LOCAL-DEMO'] });
  replayReceipts.clear();
  dealError = undefined;
}
async function dealMessage(text: string) {
  dealError = undefined;
  const current = latestThread();
  const thread = engine.receive({ id: randomUUID(), channel: 'WEB-DEMO', threadTs: current?.threadTs ?? randomUUID(), user: 'Vertex Cloud Systems', text })!;
  if (dealMode === 'live') {
    if (!getProviderStatus().agents) throw new HttpError(503, 'OpenAI is not configured. Choose replay or configure the project key.');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
    const agent = new DealAgent(engine, client, process.env.OPENAI_MODEL || 'gpt-6-astra');
    await agent.run(thread.key, thread.version, async detail => { store.audit(thread.key, 'agent_progress', detail); });
  } else {
    // Fixed rehearsal inputs have fixed decisions. Arbitrary input must never receive an invented analysis.
    const isFirst = text.trim() === firstMessage;
    const isSecond = text.trim() === secondMessage;
    const remembered = engine.context(thread.key).previousActions;
    engine.propose(thread.key, thread.version, {
      incomingTerms: isFirst ? initialOffer : isSecond ? secondOffer : null,
      proposedTerms: isFirst ? counteroffer : null,
      rationale: isFirst
        ? 'Across six synthetic negotiations, the supplier conceded 3% on annual price and 58.33% on setup fees. Request a modest price reduction, waive setup and improve payment terms while protecting a 24-month term. These are requested terms; acceptance is unconfirmed.'
        : isSecond
          ? `The supplier now requires 48 months, exceeding the 36-month policy limit. ${remembered.length ? 'Our previously sent counteroffer is remembered in this conversation.' : 'No prior counteroffer has been delivered in this conversation.'} Hold for review; no acceptance or message will be sent.`
          : 'Replay supports the two labelled sample offers only. Switch to live analysis for custom text. No commercial terms were inferred from this input.',
      evidenceRefs: isFirst ? ['HIST-001','HIST-002','HIST-003','HIST-004','HIST-005','HIST-006','BUDGET-001','POLICY-001'] : ['POLICY-001'],
    }, 'replay');
    engine.finish(thread.key, thread.version);
  }
  return dealState();
}
class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
function json(res: ServerResponse, value: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
async function bytes(req: IncomingMessage, max = 24_000) {
  const chunks: Buffer[] = []; let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > max) throw new HttpError(413, 'Request is too large.');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (req.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'Use application/json for this request.');
  try {
    const value: unknown = JSON.parse((await bytes(req)).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Invalid JSON request.'); }
}
const inputText = (value: unknown, max = 4000) => z.string().trim().min(1).max(max).parse(value);
const modeValue = (value: unknown) => z.enum(['live', 'replay']).parse(value);
async function exclusively(kind: 'deal' | 'mentor', work: () => unknown | Promise<unknown>) {
  if (kind === 'deal' ? dealBusy : mentorBusy) throw new HttpError(409, 'A review is already running. Wait for it to finish.');
  if (kind === 'deal') dealBusy = true; else mentorBusy = true;
  try { return await work(); }
  finally { if (kind === 'deal') dealBusy = false; else mentorBusy = false; }
}

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  try {
    if (!req.headers.host || !allowedHosts.has(req.headers.host)) throw new HttpError(403, 'Use the local demo address.');
    if (req.headers.origin) {
      const origin = new URL(req.headers.origin);
      if (origin.protocol !== 'http:' || !allowedHosts.has(origin.host)) throw new HttpError(403, 'Cross-origin requests are not permitted.');
    }
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Cross-site requests are not permitted.');
    const url = new URL(req.url || '/', `http://${host}:${port}`);
    const path = url.pathname;
    if (req.method === 'GET' && path === '/api/status') return json(res, { ...getProviderStatus(), slack: false, calendar: 'ics-export', gmail: 'not-connected-to-app', localDemo: true });
    if (req.method === 'GET' && path === '/api/ecosystem/state') return json(res, ecosystem.getState());
    if (req.method === 'GET' && path.startsWith('/api/ecosystem/images/')) {
      const id = path.slice('/api/ecosystem/images/'.length);
      const image = await getGeneratedImage(id);
      res.writeHead(200, { 'Content-Type': image.mime, 'Cache-Control':'private, no-store', 'Content-Length':image.buffer.length });
      return res.end(image.buffer);
    }
    if (req.method === 'DELETE' && path.startsWith('/api/ecosystem/mentors/')) {
      return json(res, ecosystem.deleteMentor(inputText(path.slice('/api/ecosystem/mentors/'.length),80)));
    }
    if (req.method === 'POST' && path === '/api/ecosystem/vision') {
      const mime=String(req.headers['content-type']||'').split(';')[0]!.trim().toLowerCase();
      if(!['image/png','image/jpeg','image/webp'].includes(mime)) throw new HttpError(415,'Use a PNG, JPEG or WebP image.');
      const image=await bytes(req,6*1024*1024);
      return json(res,{analysis:await boundedJob('image analysis',()=>analyzeImage(image,mime))});
    }
    if (req.method === 'POST' && path.startsWith('/api/ecosystem/')) {
      if(!['mentor-draft','mentors','profile','council','decision','meal-image'].some(a=>path===`/api/ecosystem/${a}`)) throw new HttpError(404,'Unknown ecosystem action.');
      const data=await body(req);
      if(path==='/api/ecosystem/mentor-draft') return json(res,{mentor:await boundedJob('mentor draft',()=>ecosystem.draftMentor(inputText(data.description,2000)))});
      if(path==='/api/ecosystem/mentors') return json(res,ecosystem.saveMentor(data.mentor));
      if(path==='/api/ecosystem/profile') return json(res,ecosystem.saveProfile(data.profile));
      if(path==='/api/ecosystem/council') return json(res,await ecosystem.council({prompt:data.prompt,mentorIds:data.mentorIds,...(data.attachment!==undefined?{attachment:data.attachment}:{})}));
      if(path==='/api/ecosystem/decision') return json(res,ecosystem.decide(inputText(data.id,80),z.enum(['approve','reject']).parse(data.action)));
      if(path==='/api/ecosystem/meal-image') return json(res,{image:await boundedJob('meal image',()=>generateMealImage(inputText(data.prompt,2000)))});
    }
    if (req.method === 'GET' && path === '/api/dealguard/state') return json(res, dealState());
    if (req.method === 'GET' && path === '/api/mentoros/state') return json(res, { ...mentor.getState(), busy: mentorBusy });
    if (req.method === 'GET' && path === '/api/mentoros/calendar.ics') {
      const ics = mentor.calendarICS();
      res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="mentoros-approved-plan.ics"', 'Cache-Control': 'no-store' });
      return res.end(ics);
    }
    if (req.method === 'POST' && path === '/api/voice/transcribe') {
      const audio = await bytes(req, 10 * 1024 * 1024);
      const filename = String(req.headers['x-filename'] || 'voice.webm');
      const mime = String(req.headers['content-type'] || 'audio/webm').split(';')[0]!;
      return json(res, { text: await transcribeAudio(audio, filename, mime) });
    }
    if (req.method === 'POST' && path === '/api/voice/speak') {
      const data = await body(req);
      const text = inputText(data.text, 2000);
      const coach = z.enum(['health', 'career']).parse(data.coach);
      const audio = await synthesizeSpeech(text, coach);
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'Content-Length': audio.length });
      return res.end(audio);
    }
    if (req.method === 'POST' && path.startsWith('/api/dealguard/')) {
      if (!['reset','message','approve','reject','reconcile'].some(a => path === `/api/dealguard/${a}`)) throw new HttpError(404, 'Unknown action.');
      const data = await body(req);
      await exclusively('deal', async () => {
        if (path === '/api/dealguard/reset') { resetDeal(modeValue(data.mode)); return; }
        if (path === '/api/dealguard/message') { await dealMessage(inputText(data.text)); return; }
        const id = inputText(data.id, 100);
        if (path === '/api/dealguard/approve') {
          if (dealMode === 'live') throw new HttpError(409, 'Live approvals require verified Slack roles and delivery. The browser can review this proposal; configure the Slack bot to approve and send.');
          engine.approve(id, 'LOCAL-DEMO'); await engine.execute(id, replaySender); return;
        }
        if (path === '/api/dealguard/reject') { engine.reject(id, 'LOCAL-DEMO'); return; }
        if (path === '/api/dealguard/reconcile') { if (dealMode === 'live') throw new HttpError(409, 'Reconcile live deliveries in the configured Slack bot.'); await engine.reconcile(id, replaySender); return; }
        throw new HttpError(404, 'Unknown action.');
      }).catch(error => { dealError = safeError(error); throw error; });
      return json(res, dealState());
    }
    if (req.method === 'POST' && path.startsWith('/api/mentoros/')) {
      if (!['reset','message','disrupt','approve','reject','retry'].some(a => path === `/api/mentoros/${a}`)) throw new HttpError(404, 'Unknown action.');
      const data = await body(req);
      await exclusively('mentor', async () => {
        if (path === '/api/mentoros/reset') { mentor.reset(modeValue(data.mode)); return; }
        if (path === '/api/mentoros/message') { await mentor.message(inputText(data.text), data.area === undefined ? undefined : inputText(data.area, 120)); return; }
        if (path === '/api/mentoros/disrupt') { await mentor.disrupt(); return; }
        if (path === '/api/mentoros/retry') { await mentor.retry(); return; }
        if (path === '/api/mentoros/approve') { mentor.approve(inputText(data.id, 100)); return; }
        if (path === '/api/mentoros/reject') { mentor.reject(inputText(data.id, 100)); return; }
        throw new HttpError(404, 'Unknown action.');
      });
      return json(res, { ...mentor.getState(), busy: mentorBusy });
    }
    if (path.startsWith('/api/')) throw new HttpError(404, 'Unknown API endpoint.');
    if (!['GET', 'HEAD'].includes(req.method || '')) throw new HttpError(405, 'Method not allowed.');
    if (path === '/') { res.writeHead(302, { Location: '/mentoros/' }); return res.end(); }
    if (path === '/mentoros' || path === '/dealguard') { res.writeHead(302, { Location: `${path}/` }); return res.end(); }
    // Explicit app routes share the shell; assets and API paths retain strict file handling.
    const mentorRoute = /^\/mentoros\/(?:dashboard|vision|mentors(?:\/[a-zA-Z0-9-]+(?:\/edit)?)?|council(?:\/review)?|planner|library(?:\/(?:receipts|meals|sources))?|context|profile)\/?$/.test(path);
    const pageSegments = decodeURIComponent(path).slice('/mentoros/'.length).split('/').filter(Boolean);
    const unknownAppPage = !mentorRoute && path.startsWith('/mentoros/') && pageSegments.length>0 && pageSegments.every(segment=>!/[.\\\x00-\x20]/.test(segment));
    const staticPath = mentorRoute || unknownAppPage ? '/mentoros/index.html' : path;
    const requestedFile = resolve(webRoot, `.${decodeURIComponent(staticPath.endsWith('/') ? `${staticPath}index.html` : staticPath)}`);
    if (!requestedFile.startsWith(webRoot + sep)) throw new HttpError(403, 'Invalid path.');
    const file = await realpath(requestedFile).catch(() => null);
    const actualWebRoot = await realpath(webRoot);
    if (!file) throw new HttpError(404, 'Page not found.');
    if (!file.startsWith(actualWebRoot + sep)) throw new HttpError(403, 'Invalid path.');
    const fileStat = await stat(file).catch(() => null);
    if (!fileStat?.isFile()) throw new HttpError(404, 'Page not found.');
    const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
    res.writeHead(unknownAppPage ? 404 : 200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : await readFile(file));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : typeof (error as any)?.status === 'number' ? Math.min(599, Math.max(400, (error as any).status)) : 400;
    const message = error instanceof z.ZodError ? 'A required field is invalid. Check the input and try again.' : safeError(error);
    if (!res.headersSent) json(res, { error: message }, status); else res.end();
  }
});
server.requestTimeout = 240_000;
server.headersTimeout = 15_000;
server.listen(port, host, () => console.log(`MentorOS: http://${host}:${port}/mentoros/\nDealGuard: http://${host}:${port}/dealguard/\nLocal demo only. Provider configuration: ${JSON.stringify(getProviderStatus())}`));
