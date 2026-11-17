/**
 * Skill compiler — canonical implementation lives in the CLI package so the
 * published `video-skill` npm package and the dashboard use one source of truth.
 * Re-exports a compiler grounded in extracted tools/steps (not an empty scaffold).
 */
export {
  compileSkill,
  validateSkillDir,
} from '../../cli/src/compiler.js';
