import { z } from 'zod';

const messageSchema = z.object({
  user: z.string(), text: z.string().optional(), ts: z.string(), thread_ts: z.string().optional(), bot_id: z.string().optional(),
}).passthrough();
const eventSchema = z.object({
  type: z.literal('message'), channel: z.string(), subtype: z.string().optional(),
  message: z.unknown().optional(), previous_message: z.unknown().optional(),
}).passthrough();

export function normalizeSupplierEvent(input: unknown, channel: string, supplierUsers: string[]) {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success || parsed.data.channel !== channel) return null;
  const event = parsed.data;
  if (event.subtype && !['message_changed', 'message_deleted', 'thread_broadcast'].includes(event.subtype)) return null;
  const candidate = event.subtype === 'message_changed' ? event.message : event.subtype === 'message_deleted' ? event.previous_message : input;
  const normalized = messageSchema.safeParse(candidate);
  if (!normalized.success) return null;
  const message = normalized.data;
  if (message.bot_id || !supplierUsers.includes(message.user)) return null;
  const text = event.subtype === 'message_deleted'
    ? 'The supplier deleted an earlier message in this negotiation. Treat its terms as withdrawn. Hold for clarification before any new counteroffer.'
    : message.text;
  if (!text) return null;
  return { channel, threadTs: message.thread_ts || message.ts, user: message.user, text, withdrawn: event.subtype === 'message_deleted' };
}
