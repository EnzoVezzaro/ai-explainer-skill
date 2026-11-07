# video-skill

Turn video tutorials into reusable, executable Agent Skills for existing AI coding agents.

**This is not a new AI coding agent, desktop app, or orchestration platform.** It augments the coding harness you already use (Codex, Claude Code, OpenCode, Cursor where compatible) with the intelligence to learn from instructional videos.

## Install

```bash
npx video-skill install
```

## Commands

```bash
video-skill providers        # detect supported coding harnesses
video-skill doctor           # check skill, Agent Reach, providers
video-skill install          # install core video-skill Agent Skill
video-skill update           # refresh an existing install
video-skill uninstall        # remove installer-managed targets
video-skill validate <dir>   # validate a generated Agent Skill
video-skill learn <url>      # extract instructional evidence from a video
video-skill create <url>     # compile a tutorial into a portable Agent Skill
```

All commands support `--json`. Build prepares a skill; execution happens only in your coding harness with your authorization.

## Architecture

Website → CLI installer → Agent Skill → Existing AI coding harness → Verified result

- Retrieval: Agent Reach (YouTube, Bilibili, generic web)
- Skill engineering: Anthropic Skill Creator conventions + Agent Skills spec
- Execution: your existing coding harness (you control permissions)

## License

MIT
