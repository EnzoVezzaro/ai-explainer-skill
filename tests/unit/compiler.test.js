import { describe, it } from 'node:test';
import assertStrict from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { compileSkill, validateSkillDir } from '../../packages/skill-compiler/src/index.js';
import { detectPlatform } from '../../packages/core/src/index.js';

const TMP = path.join('/private/var/folders/lt/lfbc4_451gg2pb0vvbz8lc4m0000gn/T/opencode', 'vskill-compiler-test');

describe('compileSkill', () => {
  it('produces a valid Agent Skill folder', async () => {
    await fs.rm(TMP, { recursive: true, force: true });
    const extraction = {
      ok: true,
      source: {
        url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
        platform: 'youtube',
        title: 'Me at the zoo',
        author: 'jawed',
        retrievedAt: '2026-01-01T00:00:00.000Z',
        retrievalTools: ['agent-reach'],
        limitations: [],
      },
      description: 'A short description.',
      transcript: 'Intro. The cool thing. End.',
      warnings: [],
      evidence: [
        { claim: 'Transcript retrieved.', sourceType: 'external-doc', timestamp: '00:00', confidence: 'medium', notes: 'n/a' },
      ],
    };
    const compiled = await compileSkill(extraction, { outDir: TMP, name: 'me-at-the-zoo' });
    assertStrict.ok(compiled.ok);
    assertStrict.strictEqual(compiled.name, 'me-at-the-zoo');

    const skillMd = await fs.readFile(path.join(compiled.path, 'SKILL.md'), 'utf8');
    assertStrict.ok(skillMd.includes('name: me-at-the-zoo'));
    assertStrict.ok(skillMd.includes('description:'));
    assertStrict.ok(skillMd.includes('https://www.youtube.com/watch?v=jNQXAC9IVRw'));
    assertStrict.ok(skillMd.includes('untrusted'));

    const refs = await fs.readdir(path.join(compiled.path, 'references'));
    assertStrict.ok(refs.includes('source.md'));
    assertStrict.ok(refs.includes('walkthrough.md'));
    assertStrict.ok(refs.includes('dependencies.md'));

    const validation = await validateSkillDir(compiled.path);
    assertStrict.ok(validation.ok, JSON.stringify(validation.issues));
  });

  it('derives a safe name from title when none given', async () => {
    await fs.rm(TMP, { recursive: true, force: true });
    const extraction = {
      ok: true,
      source: { url: 'https://example.com/v', platform: 'web', title: 'My Tutorial! @#$', retrievedAt: '2026-01-01T00:00:00.000Z', retrievalTools: [], limitations: [] },
      warnings: [], evidence: [],
    };
    const compiled = await compileSkill(extraction, { outDir: TMP });
    assertStrict.ok(/^[a-z0-9-]+$/.test(compiled.name));
    assertStrict.ok(compiled.name.length <= 64);
  });

  it('embeds extracted tools and how-to-use guidance in the skill', async () => {
    await fs.rm(TMP, { recursive: true, force: true });
    const extraction = {
      ok: true,
      source: { url: 'https://www.youtube.com/watch?v=abc', platform: 'youtube', title: '8 Free Websites', retrievedAt: '2026-01-01T00:00:00.000Z', retrievalTools: [], limitations: [] },
      description: 'TIMESTAMPS:\n0:34 KokonutUI - liquid glass components',
      tools: [{ timestamp: '0:34', name: 'KokonutUI', description: 'liquid glass components' }],
      steps: [{ timestamp: '0:00', label: 'Introduction' }, { timestamp: '0:34', label: 'KokonutUI - liquid glass components' }],
      links: ['https://kokonutui.com'],
      warnings: [], evidence: [],
    };
    const compiled = await compileSkill(extraction, { outDir: TMP, name: 'free-web-tools' });
    assertStrict.strictEqual(compiled.toolCount, 1);

    const skillMd = await fs.readFile(path.join(compiled.path, 'SKILL.md'), 'utf8');
    assertStrict.ok(skillMd.includes('KokonutUI'));
    assertStrict.ok(skillMd.includes('## Tools covered (1)'));

    const toolsMd = await fs.readFile(path.join(compiled.path, 'references', 'tools.md'), 'utf8');
    assertStrict.ok(toolsMd.includes('### 1. KokonutUI'));
    assertStrict.ok(toolsMd.includes('liquid glass components'));
    assertStrict.ok(toolsMd.includes('How to use'));

    const refs = await fs.readdir(path.join(compiled.path, 'references'));
    assertStrict.ok(refs.includes('tools.md'));

    const validation = await validateSkillDir(compiled.path);
    assertStrict.ok(validation.ok, JSON.stringify(validation.issues));
  });

  it('writes a build folder with transcript-grounded replication steps', async () => {
    await fs.rm(TMP, { recursive: true, force: true });
    const extraction = {
      ok: true,
      source: { url: 'https://www.youtube.com/watch?v=abc', platform: 'youtube', title: 'Claude Code Rules', author: 'Nate', retrievedAt: '2026-01-01T00:00:00.000Z', retrievalTools: [], limitations: [] },
      description: 'deny rules and hooks',
      transcript: 'Use deny rules to block .env. Auto mode checks commands.',
      transcriptSegments: [
        { seconds: 0, text: 'Deny rules block the .env file.' },
        { seconds: 26, text: 'Auto mode checks commands before running.' },
      ],
      steps: [
        { timestamp: '0:00', label: 'Intro' },
        { timestamp: '0:26', label: 'Auto mode' },
      ],
      links: ['https://docs.example.com'],
      tools: [],
      warnings: [], evidence: [],
    };
    const compiled = await compileSkill(extraction, { outDir: TMP, name: 'claude-rules' });
    assertStrict.strictEqual(compiled.buildSteps, 2);
    const dir = await fs.readdir(path.join(compiled.path, 'build'));
    for (const f of ['README.md', 'INSTRUCTIONS.md', 'CHECKLIST.md', 'transcript.md', 'links.md']) {
      assertStrict.ok(dir.includes(f), `missing build/${f}`);
    }
    const instructions = await fs.readFile(path.join(compiled.path, 'build', 'INSTRUCTIONS.md'), 'utf8');
    assertStrict.ok(instructions.includes('Step 1'));
    assertStrict.ok(instructions.includes('Deny rules block the .env file.'));
    assertStrict.ok(instructions.includes('Task for the agent'));
    const transcript = await fs.readFile(path.join(compiled.path, 'build', 'transcript.md'), 'utf8');
    assertStrict.ok(transcript.includes('[0:00]'));
    assertStrict.ok((await validateSkillDir(compiled.path)).ok);
  });
});

describe('detectPlatform (compiler context)', () => {
  it('returns web for generic', () => {
    assertStrict.strictEqual(detectPlatform(new URL('https://example.com/v')), 'web');
  });
});
