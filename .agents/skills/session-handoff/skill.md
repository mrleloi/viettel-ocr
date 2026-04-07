---
name: Session Handoff
description: Protocol for starting and ending work sessions. Use at beginning and end of EVERY session.
context-load: always
---

# Skill: Session Handoff

## Session Start

```
1. Read: .context/session-handoff.md → last state + pending items
2. Read: .context/agent-notes.md → learned rules + progress
3. Read: tasks/progress.md → overall progress
4. Identify: current phase step from master plan (tasks/08-master-plan.md § Session Plan)
5. Read: action guide for this session (if exists)
6. Address: any blockers from last session FIRST
7. Plan: session goals (2-4 items)
8. State plan BEFORE coding
```

## Session End — COMPLETE ALL STEPS IN ORDER, THEN RUN THE SCRIPT

```
1. Run quality gate: tsc --noEmit && jest --bail
2. Update: .context/session-handoff.md
   - What was done (with file paths)
   - What was found (surprises, issues)
   - What's next (VERBATIM from master plan)
   ⚠️ IRON LAW: "What's Next" must reference master plan session ID exactly
3. Update: tasks/progress.md
   - Mark completed items
   - Update counters
4. Update: .context/agent-notes.md (MANDATORY — not optional)
   - Progress section: ALL counters
   - Learned Rules: any new gotchas
5. Create: next session's action guide (tasks/action-guides/s{N+1}-*.md)
6. ⛔⛔⛔ RUN THIS EXACT COMMAND — YOUR SESSION IS NOT DONE WITHOUT IT ⛔⛔⛔
```

```powershell
powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\complete-session.ps1" -Message "do next session" -NewSessionDelay 5
```

⚠️ DO NOT report "session complete" to user BEFORE running the command above.
⚠️ The command validates all artifacts AND spawns the next session.
⚠️ If you wrote a walkthrough but did NOT run this command, THE SESSION IS INCOMPLETE.

## Handoff Template

```markdown
# Session Handoff

> Last updated: Session {N} ({date})
> Agent: {Claude Code | Antigravity}

## Current State
- **Phase Step**: {e.g., "1.2 — Domain entities"}
- **Build**: Backend tsc ✅/❌ | Frontend tsc ✅/❌
- **Tests**: {count} pass, {count} fail
- **Domain entities**: {X}/{Y} implemented
- **Use cases**: {X}/{Y} implemented
- **API endpoints**: {X}/{Y} implemented
- **Frontend pages**: {X}/{Y} implemented

## Done (Session {N})
{bullet list with file paths}

## Found
{surprises, design gaps, issues}

## What's Next
{VERBATIM from master plan: "Session {N+1}: {title}"}
**Skills to read**: {list}
**Action guide**: {path if exists}

## Known Issues
{ongoing issues with context}
```

## Session Naming Integrity

- **NEVER invent new session IDs** — only the master plan defines sessions
- If work is incomplete → mark current session **PARTIAL**
- Remaining work stays as sub-items under the current session
- If you need more budget → tell the user, don't silently create phantom sessions
