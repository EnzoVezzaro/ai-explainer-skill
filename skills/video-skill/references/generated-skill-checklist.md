# Generated Skill Checklist

Use before packaging or installing a generated tutorial skill.

## Portability & format

- [ ] Folder contains `SKILL.md` with valid YAML frontmatter.
- [ ] `name` is lowercase hyphen-case, <=64 chars, matches folder intent.
- [ ] `description` states what the skill does and when to use it.
- [ ] `SKILL.md` is concise; detailed material is in `references/`.

## Actionability

- [ ] Goal and expected outputs are explicit.
- [ ] Preconditions, dependencies, and environment assumptions are listed.
- [ ] Workflow steps are ordered and testable.
- [ ] Inputs/outputs are defined.

## Evidence & safety

- [ ] Source video URL/provenance is recorded.
- [ ] Retrieval limitations are disclosed.
- [ ] Spoken vs visible vs description vs external docs vs inference are distinguished where important.
- [ ] No fabricated commands/results.
- [ ] Consequential actions require explicit authorization.
- [ ] Verification steps are real and observable.

## Validation

- [ ] Skill validates against Agent Skills structure/naming rules.
- [ ] References resolve from the skill root.
- [ ] Archive extraction cannot write outside intended directories (for distributed bundles).
- [ ] Example/eval prompts cover representative use when available.
