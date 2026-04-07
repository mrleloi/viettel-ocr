---
name: Frontend Component
description: How to implement Next.js pages and React components.
context-load: once
---

# Skill: Frontend Component

## Page Pattern (Server Component default)

```typescript
// app/dashboard/page.tsx
import { apiClient } from '@/lib/api-client';

export default async function DashboardPage() {
  const stats = await apiClient.getDashboardStats();
  return <DashboardView stats={stats} />;
}
```

## Client Component (for interactivity)

```typescript
// components/upload/FileDropzone.tsx
'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes?: string[];
}

export function FileDropzone({ onFilesSelected, acceptedTypes = ['.pdf', '.zip'] }: FileDropzoneProps) {
  // ...
}
```

## Rules
- Props interface defined IN component file, exported
- Server Components default — `'use client'` only for: upload, progress, editors, dropdowns
- API calls via generated OpenAPI client (from `packages/shared`)
- React Query for server state, Zustand for UI state
- shadcn/ui for base components
- Tailwind CSS for styling
- Vietnamese text via constants (not hardcoded in JSX)
- No `any` types

## SSE Hook Pattern

```typescript
// hooks/useSSE.ts
'use client';
export function useSSE(eventTypes: string[]) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  useEffect(() => {
    const es = new EventSource('/api/events');
    eventTypes.forEach(type => {
      es.addEventListener(type, (e) => {
        setEvents(prev => [...prev, JSON.parse(e.data)]);
      });
    });
    return () => es.close();
  }, []);
  return events;
}
```

## PDF Viewer Pattern

```typescript
// Use react-pdf for inline PDF rendering
import { Document, Page } from 'react-pdf';

export function PdfViewer({ fileUrl }: { fileUrl: string }) {
  return (
    <Document file={fileUrl}>
      <Page pageNumber={1} />
    </Document>
  );
}
```
