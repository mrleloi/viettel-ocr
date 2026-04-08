/**
 * Batch domain types shared between frontend and backend.
 */

/** Batch processing status */
export type BatchStatus = 'uploading' | 'processing' | 'completed' | 'partial' | 'failed' | 'cancelled';

/** Upload mode */
export type UploadMode = 'single_ncc' | 'mixed';

/** Core batch properties */
export interface BatchProps {
  readonly id: string;
  readonly uploadMode: UploadMode;
  readonly hintSchemaId: string | null;
  readonly totalFiles: number;
  readonly processedFiles: number;
  readonly successFiles: number;
  readonly errorFiles: number;
  readonly status: BatchStatus;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
  readonly autoCreateSchemaOnNewPattern: boolean;
}
