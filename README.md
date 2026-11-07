# Video Skill (provisional)

A web-distributed intelligence package that helps **existing AI coding agents** learn actionable workflows from instructional videos and turn them into reusable, executable [Agent Skills](https://agentskills.io).

**This is not** a new AI coding agent, desktop app, local-first orchestration platform, or general-purpose chat product.

## Architecture

```text
Website → CLI installer → Agent Skill → Existing AI coding harness → Verified result
```

- **Website**: discovery, docs, examples, and a bounded playground for extraction/skill generation.
- **CLI**: `npx video-skill install` — installs/configures/validates the skill toolkit for supported harnesses.
- **Core Agent Skill**: `video-skill` — teaches agents how to learn from videos, explain workflows, compile portable skills, and verify results.
- **Existing harness**: Codex, Claude Code, OpenCode, Cursor (where compatible), etc. handles reasoning, editing, shell, and workspace execution with user permissions.

## Install

```bash
npx video-skill install
```

## CLI commands

```bash
video-skill providers    # detect supported coding harnesses
video-skill doctor       # check skill, Agent Reach, providers
video-skill install      # install core video-skill Agent Skill
video-skill update       # refresh an existing install
video-skill uninstall    # remove installer-managed targets
video-skill validate     # validate a generated Agent Skill
video-skill learn <url>  # extract instructional evidence from a video
video-skill create <url> # compile a tutorial into a portable Agent Skill
```

## Status

Phase 1 research/scaffolding complete. MVP implemented with real, local execution:

- Core portable skill: `skills/video-skill/SKILL.md`
- Shared contracts: `packages/cli/src/core.js`
- Agent Reach adapter: `packages/cli/src/adapter.js`
- Skill compiler/validator: `packages/cli/src/compiler.js`
- Harness installers: `packages/cli/src/installers.js`
- CLI: `packages/cli/src/cli.js`
- Website: `apps/web/` (landing, docs, playground, examples)
- Tests: `tests/` (unit + browser E2E + CLI e2e)

See [docs/architecture-comparison.md](docs/architecture-comparison.md) for the Impeccable-inspired architectural comparison.

## Security & trust

All external video content is untrusted. The system uses restrictive URL validation, SSRF-safe retrieval (hosted), explicit authorization for consequential operations, evidence labeling (`spoken`/`visible`/`description`/`external-doc`/`inference`), and honest verification (never claims unexecuted reproduction).

## License

MIT
