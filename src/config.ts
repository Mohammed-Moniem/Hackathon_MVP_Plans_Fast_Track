import { config as dotenv } from 'dotenv';
import { z } from 'zod';
dotenv({ path: ['.env.local', '.env'] });

const schema = z.object({
  OPENAI_API_KEY: z.string().min(20), OPENAI_MODEL: z.string().default('gpt-6-astra'),
  SLACK_BOT_TOKEN: z.string().startsWith('xoxb-'), SLACK_APP_TOKEN: z.string().startsWith('xapp-'),
  SLACK_APPROVAL_CHANNEL: z.string().regex(/^[CG][A-Z0-9]+$/),
  SLACK_SUPPLIER_CHANNEL: z.string().regex(/^[CG][A-Z0-9]+$/),
  SLACK_TEAM_ID: z.string().regex(/^T[A-Z0-9]+$/),
  SLACK_CFO_USERS: z.string().min(1), SLACK_PROCUREMENT_USERS: z.string().min(1), SLACK_SUPPLIER_USERS: z.string().min(1),
  AGENT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(120000),
  DEALGUARD_STATE_PATH: z.string().default('.dealguard/live.json'),
});
export type Config = z.infer<typeof schema>;
export function users(value: string): string[] {
  const ids = value.split(',').map(v => v.trim()).filter(Boolean);
  if (!ids.length || ids.some(id => !/^[UW][A-Z0-9]+$/.test(id))) throw new Error('Slack user settings must contain comma-separated user IDs.');
  return [...new Set(ids)];
}
export function readConfig(): Config {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) throw new Error(`Missing or invalid environment settings: ${parsed.error.issues.map(i => i.path.join('.')).join(', ')}. See .env.example. Values are never logged.`);
  const c = parsed.data;
  if (c.SLACK_APPROVAL_CHANNEL === c.SLACK_SUPPLIER_CHANNEL) throw new Error('Buyer approval and supplier channels must be different.');
  users(c.SLACK_CFO_USERS); users(c.SLACK_PROCUREMENT_USERS); users(c.SLACK_SUPPLIER_USERS);
  return c;
}
