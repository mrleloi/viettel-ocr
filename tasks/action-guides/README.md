# Action Guides

This folder contains implementation guides created by the Architect agent for the Developer agent.

## Naming Convention

```
{session}-{feature-name}.md
```

Examples:
- `s02-invoice-entity.md`
- `s02-schema-entity.md`
- `s03-fingerprint-service.md`
- `s04-confidence-calculator.md`

## Template

See `.claude/commands/action-guide.md` for the action guide template.

## Usage

1. Architect creates action guide after planning session
2. Developer reads action guide BEFORE starting implementation
3. Developer follows guide step by step (RED → GREEN → REFACTOR)
4. Developer reports deviations from guide in session handoff
