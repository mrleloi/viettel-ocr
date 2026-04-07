# /verify — Run Full Quality Gate

Run all quality checks and report status.

## Steps

1. **Gate 1: Build**
   ```bash
   cd packages/backend && npx tsc --noEmit
   cd packages/frontend && npx tsc --noEmit
   cd packages/shared && npx tsc --noEmit
   ```

2. **Gate 1: Tests**
   ```bash
   npm test -- --bail
   ```

3. **Gate 2: Architecture**
   ```bash
   # Domain purity
   grep -r "@nestjs" packages/backend/src/domain/ | wc -l  # expect 0
   grep -r ": any" packages/backend/src/domain/ | wc -l    # expect 0
   grep -rn "console.log" packages/backend/src/ --include="*.ts" | grep -v spec | grep -v test | wc -l  # expect 0
   ```

4. **Report** in format:
   ```
   ## Quality Gate Report
   - Build: ✅/❌ (errors: N)
   - Tests: ✅/❌ (pass: N, fail: N)
   - Domain purity: ✅/❌ (@nestjs imports: N)
   - No any in domain: ✅/❌ (count: N)
   - No console.log: ✅/❌ (count: N)
   ```
