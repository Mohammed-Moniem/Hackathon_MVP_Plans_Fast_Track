import OpenAI from 'openai';
import { readConfig, users } from './config.js';
import { Store, lockState } from './store.js';
import { Engine } from './engine.js';
import { DealAgent } from './agent.js';
import { createSlackBot } from './slack.js';

let release: (() => void) | undefined;
try {
  const config = readConfig();
  release = lockState(config.DEALGUARD_STATE_PATH);
  const store = new Store(config.DEALGUARD_STATE_PATH);
  const engine = new Engine(store, { CFO: users(config.SLACK_CFO_USERS), 'Procurement Director': users(config.SLACK_PROCUREMENT_USERS) });
  const client = new OpenAI({ apiKey: config.OPENAI_API_KEY, maxRetries: 0 });
  const agent = new DealAgent(engine, client, config.OPENAI_MODEL, config.AGENT_TIMEOUT_MS);
  const bot = createSlackBot(config, engine, agent);
  await bot.start();
  console.log('DealGuard is listening in the configured Slack supplier channel. Live agent · synthetic business records.');
  const shutdown = async () => { await bot.app.stop(); release?.(); process.exit(0); };
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
  process.once('exit', () => release?.());
} catch (error) {
  release?.();
  // Provider errors may contain request details; only expose our configuration errors.
  console.error(error instanceof Error && !('code' in error) && !('status' in error) ? error.message : 'Startup failed. Verify credentials, Slack access and network configuration.');
  process.exitCode = 1;
}
