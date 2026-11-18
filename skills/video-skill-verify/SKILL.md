---
name: video-skill-verify
description: Honestly verify that a workflow reproduced from a tutorial actually works, and validate generated skills. Use when the user asks "did it work?", "check the result", to validate a generated Agent Skill, or as the final gate before claiming a tutorial was replicated. Never claims unexecuted reproduction.
compatibility: Works in any Agent Skills-compatible coding harness (Codex, Claude Code, OpenCode, Cursor). Requires the video-skill MCP or CLI for skill validation.
metadata:
  author: video-skill
  version: "0.1.0"
  part-of: video-skill-suite
---

# Video Skill — Verify

Confirm real results and validate generated skills. This is the honesty gate: never say a tutorial was reproduced unless you observed evidence in the current environment.

## Non-negotiables

- Run **real** checks (tests, build/lint, API calls, smoke tests, screenshots).
- Capture logs/output as evidence for each claim.
- Compare observed behavior to the tutorial's stated objective.
- Report status explicitly as `prepared`, `executed`, `passed`, `failed`, or `unverified`.
- Never present a prepared plan as a completed build.

## With the MCP

- `validate({ path })` (or `workflow_status` → `result.validation`) checks the generated skill's frontmatter, naming and references.
- Use `list_workflows` / `workflow_status` to inspect the agent thread and steps of a build before claiming success.

## With the CLI

```bash
npx video-skill validate <skill-dir>
```

## Verification report

Include:

1. Checks run and their real outcomes.
2. Evidence (logs, screenshots, command output).
3. Unverified claims and environment differences (versions, paths, credentials).
4. Deviations from the tutorial and why.
5. Final status: passed / failed / unverified — with next steps for anything incomplete.
