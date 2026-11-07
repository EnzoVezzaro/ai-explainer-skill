#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgentReachStatus, extractVideo } from './adapter.js';
import { compileSkill, validateSkillDir } from './compiler.js';
import { detectProviders, installCoreSkill, uninstallCoreSkill } from './installers.js';
import { parsePublicUrl } from './core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const CORE_SKILL_DIR = path.join(REPO_ROOT, 'skills', 'video-skill');

function usage() {
  console.log(`video-skill (provisional MVP CLI)

Usage:
  video-skill providers [--json]
  video-skill doctor [--json]
  video-skill install [--provider <id>] [--scope project|user] [--force] [--json]
  video-skill update [--provider <id>] [--scope project|user] [--json]
  video-skill uninstall [--provider <id>] [--scope project|user] [--json]
  video-skill validate <skill-dir> [--json]
  video-skill learn <url> [--json]
  video-skill create <url> [--out <dir>] [--name <skill-name>] [--json]

Notes:
  - "Build" preparation is not execution. Execution happens only in your coding harness with authorization.
  - External video content is untrusted. Generated skills must be reviewed before privileged execution.
`);
}
function getFlag(args, name) { const i = args.indexOf(name); if (i === -1) return undefined; return args[i + 1] && !args[i + 1].startsWith('-') ? args[i + 1] : true; }
function hasFlag(args, name) { return args.includes(name); }
function print(data, json) { if (json) console.log(JSON.stringify(data, null, 2)); else if (typeof data === 'string') console.log(data); else console.log(data); }

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const json = hasFlag(args, '--json');
  try {
    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') return usage();
    if (cmd === 'providers') { const providers = await detectProviders(); const data = providers.map(p => ({ id: p.id, name: p.name, detected: p.detected, projectPath: p.projectPath, userPath: p.userPath, notes: p.notes })); if (json) return print({ ok: true, providers: data }, true); for (const p of data) console.log(`${p.detected ? '*' : '-'} ${p.id}: ${p.name}\n    project: ${p.projectPath}\n    user: ${p.userPath}\n    ${p.notes}`); return; }
    if (cmd === 'doctor') { const providers = await detectProviders(); const agentReach = getAgentReachStatus(); let coreSkillOk = false; try { coreSkillOk = (await validateSkillDir(CORE_SKILL_DIR)).ok; } catch {} const data = { ok: true, coreSkill: { path: CORE_SKILL_DIR, valid: coreSkillOk }, agentReach, providers: providers.map(p => ({ id: p.id, detected: p.detected })) }; return print(data, json); }
    if (cmd === 'install' || cmd === 'update') { const provider = getFlag(args, '--provider'); const scope = getFlag(args, '--scope') || 'project'; const force = hasFlag(args, '--force') || cmd === 'update'; const res = await installCoreSkill({ sourceDir: CORE_SKILL_DIR, providerId: typeof provider === 'string' ? provider : undefined, scope, force }); if (!json && res.ok) console.log(`Installed core skill for ${res.provider} (${res.scope}): ${res.target}`); return print(res, json); }
    if (cmd === 'uninstall') { const provider = getFlag(args, '--provider'); const scope = getFlag(args, '--scope'); const res = await uninstallCoreSkill({ providerId: typeof provider === 'string' ? provider : undefined, scope: typeof scope === 'string' ? scope : undefined }); if (!json) console.log(res.removed.length ? `Removed: ${res.removed.map(r => r.target).join(', ')}` : 'No installer-managed video-skill targets found.'); return print(res, json); }
    if (cmd === 'validate') { const dir = args.find(a => !a.startsWith('-')); if (!dir) throw new Error('Usage: video-skill validate <skill-dir>'); const res = await validateSkillDir(path.resolve(dir)); if (json) return print(res, true); console.log(res.ok ? `OK: ${dir}` : `Invalid: ${dir}`); for (const i of res.issues) console.log(`  [${i.level}] ${i.code}: ${i.message}${i.path ? ` (${i.path})` : ''}`); process.exitCode = res.ok ? 0 : 2; return; }
    if (cmd === 'learn') { const url = args.find(a => !a.startsWith('-')); if (!url) throw new Error('Usage: video-skill learn <url>'); const res = await extractVideo(url); if (!res.ok) process.exitCode = 1; return print(res, json); }
    if (cmd === 'create') { const url = args.find(a => !a.startsWith('-')); if (!url) throw new Error('Usage: video-skill create <url> [--out <dir>] [--name <skill-name>]'); const out = getFlag(args, '--out'); const name = getFlag(args, '--name'); const extraction = await extractVideo(url); if (!extraction.ok && !extraction.description && !extraction.transcript) { process.exitCode = 1; return print({ ok: false, stage: 'extract', extraction }, json); } const compiled = await compileSkill(extraction, { outDir: path.resolve(typeof out === 'string' ? out : path.join(process.cwd(), 'generated')), name: typeof name === 'string' ? name : undefined }); const validation = await validateSkillDir(compiled.path); const data = { ok: compiled.ok && validation.ok, stage: 'create', compiled, validation, extraction: { ok: extraction.ok, source: extraction.source, warnings: extraction.warnings, evidenceCount: extraction.evidence?.length || 0 } }; if (!json) console.log(`Generated skill: ${compiled.path}\nValidation: ${validation.ok ? 'OK' : 'issues found'}\nReview required before execution. This command prepares a skill; it does not execute the tutorial.`); if (!data.ok) process.exitCode = 1; return print(data, json); }
    console.error(`Unknown command: ${cmd}`); usage(); process.exitCode = 1;
  } catch (err) { const data = { ok: false, error: { code: 'CLI_ERROR', message: err instanceof Error ? err.message : String(err) } }; print(data, json); process.exitCode = 1; }
}
main();
