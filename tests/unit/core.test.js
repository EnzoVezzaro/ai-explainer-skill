import { describe, it, assert } from 'node:test';
import assertStrict from 'node:assert/strict';
import {
  parsePublicUrl,
  detectPlatform,
  slugify,
  validateSkillName,
  validateSkillDescription,
  parseSimpleFrontmatter,
  EVIDENCE_SOURCE_TYPES,
} from '../../packages/core/src/index.js';

describe('parsePublicUrl', () => {
  it('accepts https', () => {
    const r = parsePublicUrl('https://www.youtube.com/watch?v=abc');
    assertStrict.ok(r.ok);
    assertStrict.strictEqual(r.url.protocol, 'https:');
  });
  it('rejects javascript:', () => {
    const r = parsePublicUrl('javascript:alert(1)');
    assertStrict.ok(!r.ok);
    assertStrict.strictEqual(r.error.code, 'UNSUPPORTED_PROTOCOL');
  });
  it('rejects embedded credentials', () => {
    const r = parsePublicUrl('https://user:pass@youtube.com/watch?v=abc');
    assertStrict.ok(!r.ok);
    assertStrict.strictEqual(r.error.code, 'CREDENTIALS_IN_URL');
  });
  it('rejects private hosts when requested', () => {
    const r = parsePublicUrl('http://localhost:3000/x', { forbidPrivateHosts: true });
    assertStrict.ok(!r.ok);
    assertStrict.strictEqual(r.error.code, 'PRIVATE_HOST');
  });
  it('allows localhost when not forbidden', () => {
    const r = parsePublicUrl('http://localhost:3000/x');
    assertStrict.ok(r.ok);
  });
});

describe('detectPlatform', () => {
  it('detects youtube', () => {
    assertStrict.strictEqual(detectPlatform(new URL('https://youtu.be/abc')), 'youtube');
    assertStrict.strictEqual(detectPlatform(new URL('https://www.youtube.com/watch?v=abc')), 'youtube');
  });
  it('detects bilibili', () => {
    assertStrict.strictEqual(detectPlatform(new URL('https://www.bilibili.com/video/BV1xx')), 'bilibili');
    assertStrict.strictEqual(detectPlatform(new URL('https://b23.tv/abc')), 'bilibili');
  });
  it('defaults to web', () => {
    assertStrict.strictEqual(detectPlatform(new URL('https://example.com/page')), 'web');
  });
});

describe('slugify', () => {
  it('makes lowercase hyphen-case', () => {
    assertStrict.strictEqual(slugify('Build a Next.js App'), 'build-a-next-js-app');
  });
  it('caps at 64 chars', () => {
    const long = 'a'.repeat(200);
    assertStrict.strictEqual(slugify(long).length, 64);
  });
});

describe('validateSkillName', () => {
  it('accepts valid names', () => {
    assertStrict.strictEqual(validateSkillName('video-skill'), null);
    assertStrict.strictEqual(validateSkillName('build-nextjs-app'), null);
  });
  it('rejects invalid names', () => {
    assertStrict.ok(validateSkillName(''));
    assertStrict.ok(validateSkillName('-bad'));
    assertStrict.ok(validateSkillName('bad--name'));
    assertStrict.ok(validateSkillName('BAD'));
    assertStrict.ok(validateSkillName('a'.repeat(65)));
  });
});

describe('validateSkillDescription', () => {
  it('accepts valid description', () => {
    assertStrict.strictEqual(validateSkillDescription('Reproduce the workflow.'), null);
  });
  it('rejects empty / too long', () => {
    assertStrict.ok(validateSkillDescription(''));
    assertStrict.ok(validateSkillDescription('x'.repeat(1025)));
  });
});

describe('parseSimpleFrontmatter', () => {
  it('parses frontmatter', () => {
    const r = parseSimpleFrontmatter('---\nname: foo\ndescription: bar\n---\n\nbody');
    assertStrict.ok(r.ok);
    assertStrict.strictEqual(r.data.name, 'foo');
    assertStrict.strictEqual(r.data.description, 'bar');
    assertStrict.strictEqual(r.body, '\nbody');
  });
  it('rejects missing frontmatter', () => {
    const r = parseSimpleFrontmatter('just body');
    assertStrict.ok(!r.ok);
  });
});

describe('EVIDENCE_SOURCE_TYPES', () => {
  it('contains the five labels', () => {
    assertStrict.deepStrictEqual(EVIDENCE_SOURCE_TYPES, ['spoken','visible','description','external-doc','inference']);
  });
});
