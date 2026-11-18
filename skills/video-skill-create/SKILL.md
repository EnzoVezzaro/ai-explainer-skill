---
name: video-skill-create
description: Compile extracted tutorial evidence into a portable, validated Agent Skill that any coding harness can load. Use when the user asks to turn a video/tutorial into a skill, after video-skill-learn, or to regenerate/improve a generated skill. Produces SKILL.md plus references/tools.md (each tool and how to use it), walkthrough.md (ordered steps), source.md and dependencies.md.
compatibility: Works in any Agent Skills-compatible coding harness (Codex, Claude Code, OpenCode, Cursor). Requires the video-skill MCP or CLI.
metadata:
  author: video-skill
  version: "0.1.0"
  part-of: video-skill-suite
---

# Video Skill — Create

Turn extracted evidence into a focused, installable Agent Skill. Run `video-skill-learn` first (or call `extract`).

## Non-negotiables

- One focused skill per coherent tutorial workflow; no unrelated bundles.
- Lowercase hyphen-case name, <= 64 chars.
- **No fabrication**: only include tools, commands and steps that exist in the evidence. Mark gaps as review items.
- Generated skills are proposals to review, not permission to execute.

## With the MCP (preferred)

1. `extract({ url })` → evidence, or `run_workflow({ url })` → full pipeline.
2. `compile({ ... })` / the workflow's `result` yields the built skill.
3. `validate({ path })` confirms frontmatter, naming and references.
4. The workflow result includes a downloadable zip and files:
   - `SKILL.md` — operating instructions, tools covered, quick start, verification.
   - `references/tools.md` — every tool, what it does, how to use it, source link/timestamp.
   - `references/walkthrough.md` — ordered steps from the video timeline.
   - `references/source.md` — description, transcript, labeled evidence.
   - `references/dependencies.md` — tools, links, credentials to confirm.
5. Hand the skill to the user; never claim the tutorial was reproduced (see `video-skill-verify`).

## With the CLI

```bash
npx video-skill create "<url>" --out ./generated
npx video-skill validate ./generated/<skill>
```

## Quality bar

- `description` says what the skill does and when to trigger it.
- Progressive disclosure: concise SKILL.md, details in `references/`.
- Provenance: source URL, retrieval date, limitations.
- Safety: untrusted-content note and authorization boundary.
