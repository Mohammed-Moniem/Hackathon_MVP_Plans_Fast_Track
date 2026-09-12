import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { State } from './domain.js';

const empty = (): State => ({ schemaVersion: 1, threads: {}, proposals: {}, seenEvents: [], audit: [], toolResults: {} });
export class Store {
  state: State;
  readonly path?: string;
  constructor(path?: string) {
    this.path = path ? resolve(path) : undefined;
    this.state = this.path && existsSync(this.path) ? JSON.parse(readFileSync(this.path, 'utf8')) as State : empty();
    if (this.state.schemaVersion !== 1 || !this.state.threads || !this.state.proposals || !this.state.toolResults) throw new Error('Unsupported state file. Restore a known snapshot; do not overwrite live state.');
    // A crash during a send requires reconciliation, never automatic retransmission.
    let changed = false;
    for (const p of Object.values(this.state.proposals)) if (p.status === 'sending') { p.status = 'uncertain'; changed = true; }
    if (changed) this.save();
  }
  save() {
    if (!this.path) return;
    mkdirSync(dirname(this.path), { recursive: true });
    const temp = `${this.path}.tmp`;
    writeFileSync(temp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    renameSync(temp, this.path);
  }
  audit(threadKey: string, type: string, detail: string) {
    this.state.audit.push({ at: new Date().toISOString(), threadKey, type, detail });
    this.save();
  }
}

export function lockState(path: string) {
  const lock = `${resolve(path)}.lock`;
  mkdirSync(dirname(lock), { recursive: true });
  let descriptor: number;
  try { descriptor = openSync(lock, 'wx', 0o600); }
  catch { throw new Error(`Another bot may be using this state. Stop it before removing the stale lock: ${lock}`); }
  writeFileSync(descriptor, String(process.pid));
  closeSync(descriptor);
  return () => { if (existsSync(lock)) unlinkSync(lock); };
}
