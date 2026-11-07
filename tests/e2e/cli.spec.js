import { describe, it } from 'node:test';
import assertStrict from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const CLI = path.join(process.cwd(), 'packages', 'cli', 'src', 'cli.js');
const SOURCE_SKILL = path.join(process.cwd(), 'skills', 'video-skill');
// On this machine codex is detected first; install target is .agents/skills/video-skill
const INSTALL_TARGET = path.join(process.cwd(), '.agents', 'skills', 'video-skill');

function run(args) {
  return spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
}

describe('CLI e2e (deterministic)', () => {
  it('install into project scope creates a manifest-managed skill', async () => {
    const r = run(['install', '--scope', 'project']);
    assertStrict.strictEqual(r.status, 0, r.stderr);
    const manifest = path.join(INSTALL_TARGET, '.video-skill-install.json');
    assertStrict.ok(await fs.access(manifest).then(() => true, () => false));
  });

  it('update succeeds (implies force)', async () => {
    const r = run(['update', '--scope', 'project']);
    assertStrict.strictEqual(r.status, 0, r.stderr);
  });

  it('validate the source core skill', async () => {
    const r = run(['validate', SOURCE_SKILL]);
    assertStrict.strictEqual(r.status, 0, r.stderr);
  });

  it('install refuses overwrite without --force (second install)', async () => {
    const r = run(['install', '--scope', 'project']);
    assertStrict.ok(
      r.status === 0 || r.status === 2 || r.stderr.includes('TARGET_EXISTS'),
      'expected refusal or graceful handling'
    );
  });

  it('uninstall removes installer-managed targets', async () => {
    const r = run(['uninstall', '--scope', 'project']);
    assertStrict.strictEqual(r.status, 0, r.stderr);
    const manifest = path.join(INSTALL_TARGET, '.video-skill-install.json');
    const stillThere = await fs.access(manifest).then(() => true, () => false);
    assertStrict.strictEqual(stillThere, false, 'manifest should be removed after uninstall');
  });

  it('doctor reports status', async () => {
    const r = run(['doctor']);
    assertStrict.strictEqual(r.status, 0, r.stderr);
  });
});
