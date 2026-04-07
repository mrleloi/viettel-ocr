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

1. Ensure all current work is saved and committed (if applicable).

2. Verify the session's action guide has been updated with completion status.

3. Verify `tasks/progress.md` and `.context/session-handoff.md` are up to date.

4. Run the auto-next-session script to spawn a new session:

// turbo
```powershell
powershell -ExecutionPolicy Bypass -File "c:\htdocs\viettel-ocr\scripts\auto-next-session.ps1" -Message "do next session" -NewSessionDelay 5
```

## Notes

- The script uses **Ctrl+Shift+L** (open new session) → types message → Enter
- If the script fails, the user can manually open a new session and type "do next session"
- The `-NewSessionDelay` parameter (in seconds) can be increased on slower machines
- The `-Message` parameter can be customized to pass a specific prompt
- The script auto-focuses the Antigravity window even if minimized
