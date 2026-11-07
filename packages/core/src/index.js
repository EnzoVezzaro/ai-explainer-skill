/**
 * Shared contracts for the video-skill system.
 * @module @video-skill/core
 */

/** @typedef {'spoken'|'visible'|'description'|'external-doc'|'inference'} EvidenceSourceType */
/** @typedef {'low'|'medium'|'high'} Confidence */

/**
 * @typedef {Object} EvidenceRecord
 * @property {string} claim
 * @property {EvidenceSourceType} sourceType
 * @property {string} [timestamp]
 * @property {Confidence} [confidence]
 * @property {string[]} [dependencies]
 * @property {string[]} [risks]
 * @property {string} [notes]
 * @property {string} [url]
 */

/**
 * @typedef {Object} VideoSource
 * @property {string} url
 * @property {string} [platform]
 * @property {string} [title]
 * @property {string} [author]
 * @property {string} [publishedAt]
 * @property {string} [duration]
 * @property {string} retrievedAt
 * @property {string[]} retrievalTools
 * @property {string[]} limitations
 */

/**
 * @typedef {Object} ExtractionResult
 * @property {boolean} ok
 * @property {VideoSource} source
 * @property {string} [description]
 * @property {string} [transcript]
 * @property {Array<{time?: string, title: string}>} [chapters]
 * @property {string[]} [links]
 * @property {string[]} [tools]
 * @property {EvidenceRecord[]} evidence
 * @property {string[]} warnings
 * @property {{code: string, message: string, hint?: string}} [error]
 * @property {unknown} [raw]
 */

/**
 * @typedef {Object} ValidationIssue
 * @property {'error'|'warning'} level
 * @property {string} code
 * @property {string} message
 * @property {string} [path]
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} ok
 * @property {ValidationIssue[]} issues
 * @property {{name?: string, description?: string}} [frontmatter]
 */

export const EVIDENCE_SOURCE_TYPES = /** @type {const} */ ([
  'spoken', 'visible', 'description', 'external-doc', 'inference'
]);

export const DEFAULT_ALLOWED_PROTOCOLS = ['http:', 'https:'];
export const PRIVATE_HOSTNAME_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.0\.0\.0|::1|\[::1\]|169\.254\.)/i;

/**
 * Parse and validate a video/page URL.
 * For hosted/server contexts, pass `forbidPrivateHosts: true`.
 * @param {string} input
 * @param {{forbidPrivateHosts?: boolean, allowedProtocols?: string[]}} [options]
 */
export function parsePublicUrl(input, options = {}) {
  const allowed = options.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS;
  let url;
  try {
    url = new URL(String(input).trim());
  } catch {
    return { ok: false, error: { code: 'INVALID_URL', message: 'Invalid URL.' } };
  }
  if (!allowed.includes(url.protocol)) {
    return { ok: false, error: { code: 'UNSUPPORTED_PROTOCOL', message: `Only ${allowed.join(', ')} URLs are supported.` } };
  }
  if (url.username || url.password) {
    return { ok: false, error: { code: 'CREDENTIALS_IN_URL', message: 'URLs with embedded credentials are not allowed.' } };
  }
  if (options.forbidPrivateHosts && PRIVATE_HOSTNAME_RE.test(url.hostname)) {
    return { ok: false, error: { code: 'PRIVATE_HOST', message: 'Private/local network hosts are not allowed in hosted retrieval.' } };
  }
  return { ok: true, url };
}

/**
 * Best-effort platform detection for known instructional video sources.
 * @param {URL} url
 */
export function detectPlatform(url) {
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be' || host.endsWith('youtube.com')) return 'youtube';
  if (host.endsWith('bilibili.com') || host === 'b23.tv') return 'bilibili';
  if (host.endsWith('vimeo.com')) return 'vimeo';
  return 'web';
}

/**
 * Create a stable-ish slug from text.
 * @param {string} text
 */
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
    .slice(0, 64) || 'generated-skill';
}

export function nowIso() {
  return new Date().toISOString();
}

/**
 * Minimal YAML frontmatter parse for SKILL.md validation (no dependency).
 * @param {string} content
 */
export function parseSimpleFrontmatter(content) {
  const m = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return { ok: false, error: 'Missing YAML frontmatter.' };
  /** @type {Record<string, string>} */
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^['"]|['"]$/g, '').trim();
  }
  return { ok: true, data, body: content.slice(m[0].length) };
}

export function validateSkillName(name) {
  if (typeof name !== 'string' || !name) return 'name is required';
  if (name.length > 64) return 'name must be <= 64 characters';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return 'name must be lowercase alphanumeric with single hyphens';
  return null;
}

export function validateSkillDescription(desc) {
  if (typeof desc !== 'string' || !desc.trim()) return 'description is required';
  if (desc.length > 1024) return 'description must be <= 1024 characters';
  return null;
}
