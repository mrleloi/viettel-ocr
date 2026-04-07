---
description: End current session and automatically start next session with fresh context
---

# End Session & Auto-Start Next

Run this workflow at the END of every session to automatically spawn a new session with fresh context.

## Prerequisites

- All work for the current session is complete
- Session handoff document has been written
- Action guide for the next session exists in `tasks/action-guides/`
- Quality gate has passed

## Steps

1. Run the **single** completion script that validates everything and spawns next session:

// turbo
```powershell
powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\complete-session.ps1" -Message "do next session" -NewSessionDelay 5
```

That's it. ONE command. The script:
- ✅ Validates session-handoff.md is updated
- ✅ Validates progress.md exists
- ✅ Validates next action guide exists
- ✅ Runs backend tests
- ✅ Checks frontend build
- ✅ Auto-spawns next session (via auto-next-session.ps1)

If any check fails, the script exits with an error message and does NOT spawn a new session.

## Notes

- This replaces the old `auto-next-session.ps1` direct call
- The script auto-focuses the Antigravity window even if minimized
- The `-Message` parameter can be customized to pass a specific prompt
