# /action-guide — Generate Implementation Guide

Create a detailed, context-rich action guide that any agent can execute.

## Input
$ARGUMENTS — session ID + feature name (e.g., "s02 invoice-entity", "s03 fingerprint-service")

## Steps

1. **Read creator skill**: `.agents/skills/action-guide-creator/skill.md` — template and quality checks
2. **Read skill mapping**: `.agents/skills/skill-mapping/skill.md` — determine which skills to inject
3. **Follow workflow**: `.agents/workflows/create-action-guide.md` — step-by-step process
4. **Save output**: `tasks/action-guides/{session-id}-{feature-name}.md`
5. **Verify quality**: Run "fresh agent test" from action-guide-creator skill
6. **Update handoff**: Note guide location in `.context/session-handoff.md`

## Quick Quality Check

Before publishing, verify:
- [ ] Pre-flight checklist included?
- [ ] Business context with spec reference?
- [ ] All file paths exact from project root?
- [ ] Skills listed (at least 2 + quality-self-check)?
- [ ] Workflow listed?
- [ ] Key TypeScript types spelled out?
- [ ] Business rules as table?
- [ ] Quality gate copy-pasteable?
- [ ] Acceptance criteria binary?
- [ ] Fresh agent could execute this blind?
