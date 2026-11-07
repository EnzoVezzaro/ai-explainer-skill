import { describe, it } from 'node:test';
import assertStrict from 'node:assert/strict';
import { getAgentReachStatus } from '../../packages/agent-reach-adapter/src/index.js';

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
