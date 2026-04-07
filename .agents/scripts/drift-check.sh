#!/bin/bash
# Drift check — detect architecture violations
# Run: bash .agents/scripts/drift-check.sh

echo "=== Invoice Tool Drift Check ==="
echo ""

# 1. Domain purity
echo "--- Domain Layer Purity ---"
NESTJS_IN_DOMAIN=$(grep -r "@nestjs" packages/backend/src/domain/ 2>/dev/null | wc -l)
INFRA_IN_DOMAIN=$(grep -r "from.*infrastructure" packages/backend/src/domain/ 2>/dev/null | wc -l)
echo "  @nestjs imports in domain/: $NESTJS_IN_DOMAIN (expect 0)"
echo "  infrastructure imports in domain/: $INFRA_IN_DOMAIN (expect 0)"

# 2. No any in domain
echo ""
echo "--- Type Safety ---"
ANY_IN_DOMAIN=$(grep -r ": any" packages/backend/src/domain/ 2>/dev/null | wc -l)
ANY_IN_APP=$(grep -r ": any" packages/backend/src/application/ 2>/dev/null | wc -l)
echo "  :any in domain/: $ANY_IN_DOMAIN (expect 0)"
echo "  :any in application/: $ANY_IN_APP (expect 0)"

# 3. No console.log
echo ""
echo "--- Code Hygiene ---"
CONSOLE_LOG=$(grep -rn "console.log" packages/backend/src/ --include="*.ts" 2>/dev/null | grep -v ".spec.ts" | grep -v ".test.ts" | wc -l)
echo "  console.log in production: $CONSOLE_LOG (expect 0)"

# 4. Business logic in controllers
echo ""
echo "--- Controller Thinness ---"
FAT_CONTROLLERS=$(find packages/backend/src/interface/http/ -name "*.controller.ts" 2>/dev/null -exec wc -l {} + | awk '$1 > 100 {print "  WARNING: " $2 " has " $1 " lines"}')
if [ -z "$FAT_CONTROLLERS" ]; then
  echo "  All controllers < 100 lines ✓"
else
  echo "$FAT_CONTROLLERS"
fi

# 5. Test coverage
echo ""
echo "--- Test Presence ---"
DOMAIN_FILES=$(find packages/backend/src/domain/ -name "*.ts" ! -name "*.spec.ts" ! -name "*.test.ts" ! -name "index.ts" 2>/dev/null | wc -l)
DOMAIN_TESTS=$(find packages/backend/src/domain/ -name "*.spec.ts" -o -name "*.test.ts" 2>/dev/null | wc -l)
echo "  Domain files: $DOMAIN_FILES"
echo "  Domain test files: $DOMAIN_TESTS"

# 6. Repo interface vs implementation check
echo ""
echo "--- Repository Pattern ---"
REPO_INTERFACES=$(find packages/backend/src/domain/ -name "*.repository.ts" 2>/dev/null | wc -l)
REPO_IMPLS=$(find packages/backend/src/infrastructure/database/repositories/ -name "*.repository.impl.ts" 2>/dev/null | wc -l)
echo "  Repository interfaces: $REPO_INTERFACES"
echo "  Repository implementations: $REPO_IMPLS"
if [ "$REPO_INTERFACES" != "$REPO_IMPLS" ]; then
  echo "  ⚠️ MISMATCH — every interface should have an implementation"
fi

echo ""
echo "=== Done ==="
