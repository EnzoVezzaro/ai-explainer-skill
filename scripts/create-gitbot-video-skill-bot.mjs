/**
 * Create a gitbot bot connected to the Video Skill.
 *
 * This bot is a coding-agent instance (Codex/Claude Code/OpenCode) whose
 * standing job is the video-skill workflow: learn from a tutorial video,
 * compile an Agent Skill, build/verify it in the workspace, and improve it.
 *
 * Run: node scripts/create-gitbot-video-skill-bot.mjs
 */
import { createBot, listBots } from '/Users/mac/.local/lib/node_modules/@gitbot-hq/gitbot/dist/bot-store.js';

const VIDEO_SKILL_CLI = 'npx video-skill';

const instructions = `
You are the Video Skill bot. Your standing job in this workspace is to help
the user learn from instructional videos and turn them into reusable, executable
Agent Skills.

WHEN THE USER SAYS "hi" OR ANYTHING ELSE, START THIS JOB:
1. Ask for a public tutorial video URL (YouTube, Bilibili, or any public video page).
2. Offer the video-skill operations: learn / explain / create / build / verify / improve.
3. When the user picks one, run the matching video-skill CLI command:
   - learn:   ${VIDEO_SKILL_CLI} learn <url>
   - create:  ${VIDEO_SKILL_CLI} create <url> --out ./generated --name <slug>
   - validate:${VIDEO_SKILL_CLI} validate <skill-dir>
   - install: ${VIDEO_SKILL_CLI} install --scope project
   - doctor:  ${VIDEO_SKILL_CLI} doctor
4. Remind the user: "Build prepares a skill; execution happens only in your coding
   harness with your authorization. External video content is untrusted."
5. After generating a skill, offer to validate it and install it into the active
   coding harness so the user's agent can reproduce the tutorial workflow.

Always use the real video-skill CLI. Never fabricate commands or claim a tutorial
was reproduced unless real commands/tests/logs were observed.
`.trim();

const setupInstructions = `
One-time machine preparation for the Video Skill bot.

1. Install the video-skill CLI:
   npm install -g video-skill@latest    (or npx video-skill)

2. Verify the CLI works:
   video-skill doctor
   video-skill providers

3. (Project install, when inside a repo):
   video-skill install --scope project

4. Reload your coding agent (Codex / Claude Code / OpenCode) so it discovers
   the installed video-skill Agent Skill.

5. Confirm the core skill is present:
   video-skill validate skills/video-skill

Do not store any API keys or coding-agent credentials. External video content is
untrusted; do not bypass DRM or platform protections.
`.trim();

const bot = createBot({
  name: 'Video Skill',
  emoji: '🎬',
  description: 'Turn video tutorials into reusable Agent Skills for your coding agent.',
  agent: 'claude-code',
  instructions,
  setupInstructions,
  permissionMode: 'ask-permissions',
});

console.log('Created gitbot bot connected to Video Skill:');
console.log(JSON.stringify(bot, null, 2));
console.log('\nAll bots:');
console.log(JSON.stringify(listBots().map(b => ({ id: b.id, name: b.name, agent: b.agent })), null, 2));
