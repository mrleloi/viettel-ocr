# /session-end — End Work Session

Wrap up and persist state for next session.

## Steps

1. **Run quality gate**: `.agents/workflows/quality-gate-pipeline.md`
   ```bash
   cd packages/backend && npx tsc --noEmit && npx jest --bail
   cd packages/frontend && npx tsc --noEmit  # if touched
   ```

2. **Summarize work done**:
   - Files created/modified (with paths)
   - Tests written + pass/fail count
   - Issues found

3. **Update session handoff**: `.context/session-handoff.md`
   - What was done, found, next
   - ⚠️ "What's Next" = VERBATIM from master plan

4. **Update agent notes**: `.context/agent-notes.md`
   - Progress counters
   - New learned rules

5. **Update progress**: `tasks/progress.md`
   - Mark completed items
   - Update phase step status

6. **Commit**: `docs: session {N} handoff`

7. **If Architect**: create action guides for next Antigravity session
