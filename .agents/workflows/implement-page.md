---
description: Implement a Next.js frontend page end-to-end.
---

# Workflow: Implement Page

## Steps

### 1. Read Spec
- Read `tasks/01-business-spec.md` for the page's feature description
- Read `tasks/06-low-level-design.md` for component list
- Check API endpoints are implemented and working

### 2. Create Page Route
- File: `packages/frontend/src/app/{page}/page.tsx`
- Server Component by default
- Fetch data via generated API client

### 3. Create Components
For each component on the page:
- File: `packages/frontend/src/components/{area}/{ComponentName}.tsx`
- Props interface exported from component file
- Use shadcn/ui base components
- Tailwind CSS for styling
- Responsive classes (sm:, md:, lg:)

### 4. Wire API Client
- Use React Query hooks for data fetching
- Handle loading, error, empty states
- SSE integration for real-time updates (if needed)

### 5. Vietnamese Text
- All user-facing text via constants or i18n
- No hardcoded Vietnamese strings in JSX

### 6. Verify
```bash
cd packages/frontend && npx tsc --noEmit
# Manual: open page in browser, check all sections render
```

## Quality Checklist
- [ ] Page renders without console errors
- [ ] All data loads from API (not hardcoded)
- [ ] Loading states shown during API calls
- [ ] Error states shown when API fails
- [ ] Empty states shown when no data
- [ ] Responsive at 768px and 1440px
- [ ] All text in Vietnamese
- [ ] No `any` types
