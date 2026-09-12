import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSupplierEvent } from '../src/slack-events.js';
const message = { type: 'message', channel: 'CSUPPLIER', user: 'USUPPLIER', text: 'Offer', ts: '1.1', thread_ts: '1.0' };
test('only configured supplier identities in the dedicated channel trigger analysis', () => {
  assert.equal(normalizeSupplierEvent(message, 'CPRIVATE', ['USUPPLIER']), null);
  assert.equal(normalizeSupplierEvent(message, 'CSUPPLIER', ['UOTHER']), null);
  assert.equal(normalizeSupplierEvent({ ...message, bot_id: 'B123' }, 'CSUPPLIER', ['USUPPLIER']), null);
  assert.equal(normalizeSupplierEvent(message, 'CSUPPLIER', ['USUPPLIER'])!.threadTs, '1.0');
});
test('edited and deleted supplier messages invalidate the same original thread', () => {
  const edit = normalizeSupplierEvent({ type: 'message', channel: 'CSUPPLIER', subtype: 'message_changed', message: { ...message, text: '48 months' } }, 'CSUPPLIER', ['USUPPLIER'])!;
  assert.equal(edit.threadTs, '1.0'); assert.equal(edit.text, '48 months');
  const deletion = normalizeSupplierEvent({ type: 'message', channel: 'CSUPPLIER', subtype: 'message_deleted', previous_message: message }, 'CSUPPLIER', ['USUPPLIER'])!;
  assert.equal(deletion.threadTs, '1.0'); assert.match(deletion.text, /withdrawn/);
});
