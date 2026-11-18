# Video Skill

Turn a public tutorial URL into a **portable Agent Skill** that teaches an existing AI coding agent the exact tools and workflow demonstrated in the video.

**This is not** a new AI coding agent, desktop app, or orchestration platform. It augments the coding harness you already use (Codex, Claude Code, OpenCode, Cursor where compatible).

**Website:** https://enzovezzaro.github.io/ai-explainer-skill/ — the landing page, docs, examples and playground are published with GitHub Pages on every release.

## Architecture

```text
URL (video/social/page) → extract → structured evidence → compile → Agent Skill → your coding harness
```

- **CLI** (`video-skill`): extract, compile, validate, install — works standalone via `npx`.
- **Agent Skill** (`video-skill`): teaches the harness how to learn from videos and verify results.
- **Dashboard** (`apps/dashboard`): collections, agent actions, MCP connection, REST API.
- **Website** (`apps/web`): discovery, docs, examples, playground.

## Install

```bash
npx video-skill install
```

No install needed to try it — `npx` fetches the CLI on demand.

## Quick start

```bash
# See what the tool found (tools, links, steps, evidence)
npx video-skill learn "https://www.youtube.com/watch?v=9NubqbSNbjg" --json

# Compile a real, installable Agent Skill
npx video-skill create "https://www.youtube.com/watch?v=9NubqbSNbjg" --out ./generated

# Validate it
npx video-skill validate ./generated/<skill-name>
```

The generated skill contains a `SKILL.md` plus `references/tools.md` (every tool mentioned, what it does, how to use it), `references/walkthrough.md` (ordered steps from the video timeline), `references/source.md` (description, transcript, evidence) and `references/dependencies.md`.

## Supported sources

| Platform | Extraction |
|---|---|
| YouTube | Agent Reach `read` + `yt-dlp` fallback for metadata/description; subtitles or Whisper `transcribe` for transcript |
| Bilibili | Agent Reach `read` + `subtitle` |
| Instagram / X (Twitter) / TikTok | Agent Reach platform actions with generic web fallback |
| Any public web page | Agent Reach generic `read` |

Retrieval is resilient: if Agent Reach is rate-limited or unavailable, `yt-dlp` is used for YouTube metadata/description so the core flow still produces a real skill. External content is always treated as untrusted, and a missing transcript is reported honestly rather than fabricated.

## CLI commands

```bash
video-skill providers                       # detect supported coding harnesses
video-skill doctor                          # check skill, Agent Reach, providers
video-skill install                         # install core video-skill Agent Skill
video-skill update                          # refresh an existing install
video-skill uninstall                       # remove installer-managed targets
video-skill validate <dir>                  # validate a generated Agent Skill
video-skill learn <url>                     # extract structured evidence from a URL
video-skill create <url> [--out <dir>] [--name <name>]  # compile a portable Agent Skill
```

All commands support `--json`. **Build prepares a skill; it does not execute the tutorial.** Execution happens only in your coding harness with your authorization.

## Dashboard, REST API & MCP

```bash
npm run dev        # dashboard server on http://localhost:3002
npm run dev:web    # marketing website on http://localhost:5173
```

- **REST API**: `/api/collections`, `/api/extract`, `/api/validate`, `/api/actions`, `/api/search`
- **MCP endpoint**: `/mcp` — tools `extract`, `compile`, `validate`, `list_collections`
- Collections are stored locally at `~/.video-skill` (no hosted DB required).

## Tests

```bash
npm test           # unit + CLI e2e
npm run test:e2e   # Playwright browser E2E
```

## Security & trust

All external content is untrusted. The system uses restrictive URL validation, explicit authorization for consequential operations, evidence labeling (`spoken`/`visible`/`description`/`external-doc`/`inference`), and honest verification (never claims unexecuted reproduction). No credentials are stored in generated skills.

## License

MIT
