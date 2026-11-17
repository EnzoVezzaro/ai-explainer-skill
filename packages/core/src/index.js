/**
 * Shared contracts — canonical implementation lives in the CLI package so the
 * published `video-skill` npm package and the dashboard use one source of truth.
 * @module @video-skill/core
 */
export {
  EVIDENCE_SOURCE_TYPES,
  DEFAULT_ALLOWED_PROTOCOLS,
  PRIVATE_HOSTNAME_RE,
  parsePublicUrl,
  detectPlatform,
  slugify,
  nowIso,
  parseSimpleFrontmatter,
  validateSkillName,
  validateSkillDescription,
} from '../../cli/src/core.js';
