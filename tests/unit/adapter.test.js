import { describe, it } from 'node:test';
import assertStrict from 'node:assert/strict';
import { getAgentReachStatus, parseDescription } from '../../packages/agent-reach-adapter/src/index.js';

describe('getAgentReachStatus', () => {
  it('reports install status', () => {
    const s = getAgentReachStatus();
    assertStrict.ok(typeof s.installed === 'boolean');
    if (s.installed) {
      assertStrict.ok(typeof s.path === 'string' && s.path.length > 0);
      assertStrict.ok(typeof s.channelsOk === 'boolean');
    }
  });
});

describe('parseDescription', () => {
  const description = [
    'These 8 free websites make your AI sites look premium.',
    'TRY LIMORA NOW https://limora.ai - build brand assets.',
    'TIMESTAMPS:',
    '0:00 Introduction',
    '0:34 KokonutUI - liquid glass components',
    '1:55 React Bits - shader gradient backgrounds',
    '3:08 Bklit - designed charts with video export',
    '9:29 Conclusion',
    'TOOLKIT (all links): https://logiaweb.net/vibe-coder-toolkit',
    '#vibecoding #webdesign',
  ].join('\n');

  it('extracts tools from a timestamped description (skipping intro/outro)', () => {
    const { tools } = parseDescription(description);
    assertStrict.strictEqual(tools.length, 3);
    assertStrict.strictEqual(tools[0].name, 'KokonutUI');
    assertStrict.strictEqual(tools[0].description, 'liquid glass components');
    assertStrict.strictEqual(tools[0].timestamp, '0:34');
  });

  it('extracts links', () => {
    const { links } = parseDescription(description);
    assertStrict.ok(links.includes('https://limora.ai'));
    assertStrict.ok(links.includes('https://logiaweb.net/vibe-coder-toolkit'));
  });

  it('extracts ordered steps including intro/outro', () => {
    const { steps } = parseDescription(description);
    assertStrict.strictEqual(steps[0].timestamp, '0:00');
    assertStrict.strictEqual(steps[steps.length - 1].label, 'Conclusion');
  });

  it('returns empty arrays for an empty description', () => {
    const r = parseDescription('');
    assertStrict.deepStrictEqual(r, { tools: [], steps: [], links: [], keyPoints: [] });
  });
});
