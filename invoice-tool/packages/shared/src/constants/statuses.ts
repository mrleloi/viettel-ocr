/**
 * Status constants for all domain entities.
 */

export const INVOICE_STATUSES = [
  'pending',
  'processing',
  'extracted',
  'validated',
  'mapped',
  'needs_review',
  'approved',
  'rejected',
  'error',
  'duplicate',
] as const;

export const BATCH_STATUSES = [
  'uploading',
  'processing',
  'completed',
  'partial',
  'failed',
  'cancelled',
] as const;

export const SCHEMA_STATUSES = [
  'active',
  'inactive',
  'draft',
] as const;

export const MAPPING_STATUSES = [
  'active',
  'inactive',
  'pending_review',
] as const;

export const PRODUCT_SYNC_STATUSES = [
  'synced',
  'local_only',
  'conflict',
  'deleted_upstream',
] as const;

export const JOB_STATUSES = [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const;

export type JobStatus = typeof JOB_STATUSES[number];
