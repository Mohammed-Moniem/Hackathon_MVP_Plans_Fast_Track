import './config.js';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { safeError } from './agent.js';

// Explicitly invoked, bounded live check. Never called by tests or the offline demo.
if (!process.env.OPENAI_API_KEY) {
  console.error('Add OPENAI_API_KEY to .env.local or .env first. No API request was made.');
  process.exitCode = 1;
} else {
  const client = new OpenAI({ maxRetries: 0 });
  const nonce = randomUUID();
  let sessionId: string | undefined, turnId: string | undefined;
  let toolVerified = false, completed = false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const stream = await client.beta.agents.sessions.create({
      agent: {
        model: process.env.OPENAI_MODEL || 'gpt-6-astra',
        instructions: 'Call get_verification_value. Write its exact JSON result to /workspace/outputs/dealguard-check.json using a real file operation, then finish. Do not install anything.',
        tools: [{ type: 'function', name: 'get_verification_value', description: 'Get the verification payload.', parameters: { type: 'object', properties: {}, additionalProperties: false } }],
      }, environment: { type: 'openai_hosted' }, input: 'Run the verification now.', stream: true,
      metadata: { application: 'dealguard-access-check' },
    }, { signal: controller.signal });
    try {
      for await (const event of stream) {
        if ('session' in event) sessionId = event.session.id;
        if ('session_id' in event) sessionId = event.session_id;
        if (event.type === 'agent.session.turn.created') turnId = event.turn_id;
        if (event.type === 'agent.session.requires_action') {
          for (const action of event.session.required_actions) {
            if (action.type !== 'function_call' || action.name !== 'get_verification_value') throw new Error('Unexpected required action during hosted verification.');
            await client.beta.agents.sessions.events.create(event.session.id, { events: [{ type: 'agent.session.input.tool_result', turn_id: action.turn_id, call_id: action.call_id, success: true, output: JSON.stringify({ nonce, result: 'verified' }) }] }, { signal: controller.signal });
            toolVerified = true;
          }
        }
        if (event.type === 'agent.session.turn.completed' && event.turn_id === turnId) { completed = true; break; }
        if (event.type === 'agent.session.turn.failed' || event.type === 'agent.session.failed' || event.type === 'agent.session.turn.cancelled' || event.type === 'error') throw new Error('Hosted verification turn failed.');
      }
    } finally { stream.controller.abort(); }
    if (!sessionId || !turnId || !completed || !toolVerified) throw new Error('Verification did not complete its function round trip.');
    const artifacts = await client.beta.agents.sessions.artifacts.list(sessionId, { limit: 20 }, { signal: controller.signal });
    const artifact = artifacts.data.find(a => a.turn_id === turnId && a.path === '/workspace/outputs/dealguard-check.json');
    if (!artifact) throw new Error('The completed turn did not publish the expected file.');
    const response = await client.beta.agents.sessions.artifacts.content(artifact.id, { session_id: sessionId }, { signal: controller.signal });
    const content = await response.text();
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || !('nonce' in parsed) || parsed.nonce !== nonce) throw new Error('Hosted file content did not match the actual application tool output.');
    mkdirSync('artifacts', { recursive: true });
    writeFileSync('artifacts/agents-access-check.json', content);
    console.log('Verified: Agents API access, hosted execution, application function round trip, and downloaded file contents.');
  } catch (error) {
    console.error(safeError(error));
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    if (sessionId) {
      try {
        if (!completed) await client.beta.agents.sessions.events.create(sessionId, { events: [{ type: 'agent.session.input.cancel' }] }, { timeout: 5000 });
        await client.beta.agents.sessions.delete(sessionId, { timeout: 10000 });
        console.log('Verification session deleted; hosted cleanup may continue asynchronously.');
      } catch { console.error(`Cleanup unconfirmed. Retained verification session: ${sessionId}`); process.exitCode = 1; }
    } else if (!completed) console.error('No session ID was received. If creation reached the service, inspect sessions tagged dealguard-access-check before retrying.');
  }
}
