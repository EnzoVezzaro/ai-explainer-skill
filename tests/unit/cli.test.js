import { describe, it } from 'node:test';
import assertStrict from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const CLI = path.join(process.cwd(), 'packages', 'cli', 'src', 'cli.js');

function run(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
}

describe('CLI', () => {
  it('providers returns detected providers', () => {
    const r = run(['providers']);
    assertStrict.strictEqual(r.status, 0);
    assertStrict.ok(r.stdout.includes('codex') || r.stdout.includes('claude-code'));
  });
  it('doctor runs', () => {
    const r = run(['doctor']);
    assertStrict.strictEqual(r.status, 0);
  });
  it('validate rejects missing dir', () => {
    const r = run(['validate']);
    assertStrict.notStrictEqual(r.status, 0);
  });
  it('create rejects missing url', () => {
    const r = run(['create']);
    assertStrict.notStrictEqual(r.status, 0);
  });
  it('learn rejects invalid url', () => {
    const r = run(['learn', 'not a url']);
    assertStrict.notStrictEqual(r.status, 0);
  });
});
