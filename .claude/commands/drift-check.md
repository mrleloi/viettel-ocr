# /drift-check — Detect Architecture Violations

Run architecture drift detection.

## Steps

1. **Run script**: `bash .agents/scripts/drift-check.sh`
2. **Review output**: Check each section for violations
3. **Fix violations**: Any non-zero counts are drift signals

## Drift Signals

| Signal | Meaning | Fix |
|--------|---------|-----|
| @nestjs in domain/ | Framework leaked into domain | Move to infrastructure/ |
| :any in domain/ | Type safety violation | Add explicit types |
| console.log in production | Debug code left in | Remove or use logger |
| Controller >100 lines | Business logic in controller | Extract to use case |
| Repo interface without impl | Missing DB implementation | Create impl in infrastructure/ |
| Domain files without tests | Missing test coverage | Write tests (RED phase) |
