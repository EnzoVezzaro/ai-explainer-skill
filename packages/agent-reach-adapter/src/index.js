/**
 * Agent Reach adapter — canonical implementation lives in the CLI package so
 * the published `video-skill` npm package and the dashboard use one source of truth.
 * Re-exports: resilient extraction (Agent Reach -> yt-dlp) + structured parsing.
 */
export {
  extractVideo,
  getAgentReachStatus,
  parseDescription,
} from '../../cli/src/adapter.js';
