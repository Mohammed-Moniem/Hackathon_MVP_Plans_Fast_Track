import type { Engine, Sender } from './engine.js';
import type { DealAgent } from './agent.js';
import { type Config, users } from './config.js';
import { evidenceBlocks, proposalBlocks } from './slack-ui.js';
import type { Proposal } from './domain.js';
import { normalizeSupplierEvent } from './slack-events.js';
import { SlackNativeApp, SlackApiError, object, type SlackNativeOptions, type SlackResponse } from './slack-native.js';

const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d+\.\d+$/.test(value);

export class SlackSender implements Sender {
  constructor(readonly app: Pick<SlackNativeApp, 'client'>, readonly engine: Engine) {}
  async send(p: Proposal) {
    if (p.mode !== 'live' || !p.text) throw new Error('Only an exact live counteroffer can be sent to Slack.');
    const thread = this.engine.thread(p.threadKey);
    const result = await this.app.client.chat.postMessage({
      channel: thread.channel, thread_ts: thread.threadTs, text: p.text!,
      metadata: { event_type: 'dealguard_counteroffer', event_payload: { proposal_id: p.id } },
      unfurl_links: false, unfurl_media: false,
    });
    if (!result.ok || !timestamp(result.ts) || result.channel !== thread.channel) throw new Error('Missing or invalid Slack delivery receipt.');
    return { messageTs: result.ts, channel: result.channel };
  }
  async find(p: Proposal) {
    if (p.mode !== 'live' || !p.text) return null;
    const thread = this.engine.thread(p.threadKey);
    const identity = this.app.client.identity ?? await this.app.client.auth.test();
    if (!identity.user_id && !identity.bot_id) throw new Error('Slack bot identity is unavailable for receipt verification.');
    let cursor: string | undefined;
    const cursors = new Set<string>();
    const deadline = AbortSignal.timeout(30_000);
    // Bounded reconciliation; failure to locate is never permission to resend.
    for (let page = 0; page < 10; page++) {
      const result = await this.app.client.conversations.replies({ channel: thread.channel, ts: thread.threadTs, cursor, limit: 100, include_all_metadata: true }, deadline);
      if (!Array.isArray(result.messages)) throw new SlackApiError('invalid_response');
      const match = result.messages.find(message => {
        if (!object(message)) return false;
        const payload = message.metadata?.event_payload;
        const authoredByBot = identity.user_id && message.user === identity.user_id || identity.bot_id && message.bot_id === identity.bot_id;
        return authoredByBot && message.thread_ts === thread.threadTs && timestamp(message.ts)
          && message.metadata?.event_type === 'dealguard_counteroffer' && object(payload)?.proposal_id === p.id && message.text === p.text;
      });
      if (timestamp(match?.ts)) return { messageTs: match.ts, channel: thread.channel };
      cursor = result.response_metadata?.next_cursor;
      if (typeof cursor !== 'string' || !cursor.trim() || cursors.has(cursor)) break;
      cursors.add(cursor);
    }
    return null;
  }
}

export function createSlackBot(c: Config, engine: Engine, agent: Pick<DealAgent, 'run'>, options: SlackNativeOptions = {}) {
  // Fail before network access when the embedded app connector has not been configured.
  const required = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_TEAM_ID', 'SLACK_APPROVAL_CHANNEL', 'SLACK_SUPPLIER_CHANNEL',
    'SLACK_CFO_USERS', 'SLACK_PROCUREMENT_USERS', 'SLACK_SUPPLIER_USERS'] as const;
  const missing = required.filter(key => typeof c[key] !== 'string' || !c[key].trim());
  if (missing.length) throw new Error(`Slack is not configured. Missing settings: ${missing.join(', ')}.`);
  if (!/^xoxb-/.test(c.SLACK_BOT_TOKEN) || !/^xapp-/.test(c.SLACK_APP_TOKEN) || !/^T[A-Z0-9]+$/.test(c.SLACK_TEAM_ID)
    || !/^[CG][A-Z0-9]+$/.test(c.SLACK_APPROVAL_CHANNEL) || !/^[CG][A-Z0-9]+$/.test(c.SLACK_SUPPLIER_CHANNEL)) throw new Error('Slack settings are invalid. Check project configuration.');
  if (c.SLACK_APPROVAL_CHANNEL === c.SLACK_SUPPLIER_CHANNEL) throw new Error('Buyer approval and supplier channels must be different.');
  const app = new SlackNativeApp(c.SLACK_BOT_TOKEN, c.SLACK_APP_TOKEN, options);
  const sender = new SlackSender(app, engine);
  const queues = new Map<string, Promise<void>>();
  const actionQueues = new Map<string, Promise<void>>();
  const supplierUsers = users(c.SLACK_SUPPLIER_USERS);
  const buyerUsers = new Set([...users(c.SLACK_CFO_USERS), ...users(c.SLACK_PROCUREMENT_USERS)]);

  async function refresh(p: Proposal) {
    if (!p.approvalMessageTs) return;
    await app.client.chat.update({ channel: c.SLACK_APPROVAL_CHANNEL, ts: p.approvalMessageTs, text: `DealGuard: ${p.status}`, blocks: proposalBlocks(p) });
  }
  async function supplierEvent(body: Record<string, unknown>) {
    if (body.type !== 'event_callback' || body.team_id !== c.SLACK_TEAM_ID || typeof body.event_id !== 'string' || !body.event_id) return;
    const normalized = normalizeSupplierEvent(body.event, c.SLACK_SUPPLIER_CHANNEL, supplierUsers);
    if (!normalized) return;
    const thread = engine.receive({ id: body.event_id, ...normalized });
    if (!thread) return;
    const work = (queues.get(thread.key) ?? Promise.resolve()).catch(() => {}).then(async () => {
      if (engine.thread(thread.key).version !== thread.version) return;
      for (const old of Object.values(engine.state.proposals).filter(p => p.threadKey === thread.key && p.status === 'stale').slice(-20)) await refresh(old).catch(() => {});
      const note = await app.client.chat.postMessage({ channel: c.SLACK_APPROVAL_CHANNEL, text: `DealGuard · live review of supplier offer v${thread.version}. Business context uses sample data.` });
      if (!timestamp(note.ts) || note.channel !== c.SLACK_APPROVAL_CHANNEL) throw new Error('Missing buyer notification receipt.');
      const noteTs = note.ts;
      let progressCalls = 0;
      let lastProgressAt = 0;
      const progress = async (text: string) => {
        if (++progressCalls > 12 || Date.now() - lastProgressAt < 1000) return;
        lastProgressAt = Date.now();
        await app.client.chat.update({ channel: c.SLACK_APPROVAL_CHANNEL, ts: noteTs, text: `DealGuard · ${text}` }).catch(() => {});
      };
      try {
        engine.assertCurrent(thread.key, thread.version);
        const p = await agent.run(thread.key, thread.version, progress);
        p.approvalMessageTs = noteTs;
        engine.store.save();
        await refresh(p);
      } catch {
        await app.client.chat.update({ channel: c.SLACK_APPROVAL_CHANNEL, ts: noteTs,
          text: 'DealGuard · Review stopped. No supplier message sent. Check local audit for status; post a revised offer after resolving the issue.' }).catch(() => {});
      }
    });
    queues.set(thread.key, work);
    void work.catch(() => { engine.store.audit(thread.key, 'slack_notification_failed', 'Buyer notification could not be delivered. Inspect permissions/network and retained proposal state.'); })
      .finally(() => { if (queues.get(thread.key) === work) queues.delete(thread.key); }).catch(() => {});
  }

  const actionIds = new Set(['dealguard_approve', 'dealguard_reject', 'dealguard_evidence', 'dealguard_reconcile']);
  async function buyerAction(body: Record<string, unknown>) {
    if (body.type !== 'block_actions' || object(body.team)?.id !== c.SLACK_TEAM_ID || object(body.channel)?.id !== c.SLACK_APPROVAL_CHANNEL) return;
    const user = object(body.user)?.id;
    // Unauthorized actors receive no private proposal/evidence data, even in errors.
    if (typeof user !== 'string' || !buyerUsers.has(user)) return;
    const action = Array.isArray(body.actions) && body.actions.length === 1 ? object(body.actions[0]) : undefined;
    if (!action || typeof action.action_id !== 'string' || !actionIds.has(action.action_id) || typeof action.value !== 'string' || !action.value) return;
    const proposalId = action.value, actionId = action.action_id;
    const respond = async (response: SlackResponse) => {
      if (typeof body.response_url === 'string') await app.client.respond(body.response_url, response);
      else await app.client.chat.postEphemeral({ channel: c.SLACK_APPROVAL_CHANNEL, user, text: response.text, blocks: response.blocks });
    };
    const work = (actionQueues.get(proposalId) ?? Promise.resolve()).catch(() => {}).then(async () => {
      try {
        const p = engine.proposal(proposalId);
        if (!timestamp(p.approvalMessageTs) || object(body.message)?.ts !== p.approvalMessageTs) throw new Error('This approval card is not current.');
        if (actionId === 'dealguard_evidence') {
          await respond({ response_type: 'ephemeral', replace_original: false, text: 'DealGuard evidence', blocks: evidenceBlocks(p) });
          return;
        }
        if (actionId === 'dealguard_approve') { engine.approve(p.id, user); await engine.execute(p.id, sender); }
        else if (actionId === 'dealguard_reject') engine.reject(p.id, user);
        else await engine.reconcile(p.id, sender);
        await refresh(p);
      } catch (error) {
        const message = error instanceof Error && !('code' in error) ? error.message : 'Slack action failed. Inspect the stored proposal; no automatic resend was attempted.';
        await respond({ response_type: 'ephemeral', replace_original: false, text: message }).catch(() => {});
      }
    });
    actionQueues.set(proposalId, work);
    try { await work; } finally { if (actionQueues.get(proposalId) === work) actionQueues.delete(proposalId); }
  }
  app.onEnvelope(async envelope => {
    if (envelope.type === 'events_api') await supplierEvent(envelope.payload);
    else if (envelope.type === 'interactive') await buyerAction(envelope.payload);
  });
  app.error(async () => { console.error('Slack transport error. Check configuration/network. Sensitive payloads are omitted.'); });
  let starting: Promise<void> | undefined;
  async function start() {
    if (starting) return starting;
    if (app.status === 'connected' || app.status === 'reconnecting') return;
    const work = (async () => {
      const auth = await app.client.auth.test();
      if (auth.team_id !== c.SLACK_TEAM_ID) throw new Error('Slack token belongs to a different workspace.');
      if (!(typeof auth.user_id === 'string' && /^[UW][A-Z0-9]+$/.test(auth.user_id))
        && !(typeof auth.bot_id === 'string' && /^B[A-Z0-9]+$/.test(auth.bot_id))) throw new Error('Slack authentication did not return a bot identity.');
      const info = await app.client.conversations.info({ channel: c.SLACK_APPROVAL_CHANNEL });
      if (info.channel?.is_private !== true || info.channel.is_member !== true) throw new Error('Approval channel must be private and include the bot.');
      const supplier = await app.client.conversations.info({ channel: c.SLACK_SUPPLIER_CHANNEL });
      if (supplier.channel?.is_member !== true) throw new Error('Invite DealGuard to the supplier demo channel.');
      // Restore a bounded number of current cards; do not replay sends or post new cards.
      for (const p of Object.values(engine.state.proposals).filter(p => p.approvalMessageTs && ['pending', 'uncertain', 'stale'].includes(p.status)).slice(-50)) await refresh(p);
      await app.start();
    })();
    starting = work;
    try { await work; } finally { if (starting === work) starting = undefined; }
  }
  return {
    app,
    sender,
    start,
  };
}
