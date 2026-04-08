import { DomainError } from '../shared/domain-error';
import { generateId } from '../shared/identifier';
import type { BatchProps, BatchStatus, UploadMode } from '@invoice-tool/shared';

const VALID_UPLOAD_MODES: UploadMode[] = ['single_ncc', 'mixed'];

/** Props required to create a new Batch */
export interface CreateBatchProps {
  readonly id?: string;
  readonly uploadMode: string;
  readonly totalFiles: number;
  readonly hintSchemaId?: string | null;
  readonly autoCreateSchemaOnNewPattern?: boolean;
}

/**
 * Batch entity — groups uploaded invoice files for processing.
 * Tracks progress of file processing and auto-transitions status on completion.
 */
export class Batch {
  private props: BatchProps;

  private constructor(props: BatchProps) {
    this.props = props;
  }

  /**
   * Create a new Batch (uploading status).
   * @param input Required fields for a new batch
   * @returns A new Batch instance
   * @throws DomainError if totalFiles invalid or uploadMode invalid
   */
  static create(input: CreateBatchProps): Batch {
    if (!VALID_UPLOAD_MODES.includes(input.uploadMode as UploadMode)) {
      throw new DomainError(`Invalid upload mode: "${input.uploadMode}". Must be one of: ${VALID_UPLOAD_MODES.join(', ')}`);
    }
    if (!input.totalFiles || input.totalFiles <= 0) {
      throw new DomainError('Batch total files must be positive');
    }

    return new Batch({
      id: input.id ?? generateId(),
      uploadMode: input.uploadMode as UploadMode,
      hintSchemaId: input.hintSchemaId ?? null,
      totalFiles: input.totalFiles,
      processedFiles: 0,
      successFiles: 0,
      errorFiles: 0,
      status: 'uploading',
      createdAt: new Date(),
      completedAt: null,
      autoCreateSchemaOnNewPattern: input.autoCreateSchemaOnNewPattern ?? false,
    });
  }

  /**
   * Reconstitute a Batch from stored data (skips validation).
   * @param props All batch properties from persistence
   * @returns A Batch instance
   */
  static reconstitute(props: BatchProps): Batch {
    return new Batch({ ...props });
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get uploadMode(): UploadMode { return this.props.uploadMode; }
  get hintSchemaId(): string | null { return this.props.hintSchemaId; }
  get totalFiles(): number { return this.props.totalFiles; }
  get processedFiles(): number { return this.props.processedFiles; }
  get successFiles(): number { return this.props.successFiles; }
  get errorFiles(): number { return this.props.errorFiles; }
  get status(): BatchStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get completedAt(): Date | null { return this.props.completedAt; }
  get autoCreateSchemaOnNewPattern(): boolean { return this.props.autoCreateSchemaOnNewPattern; }

  // --- State Transitions ---

  /**
   * Start processing uploaded files.
   * @throws DomainError if not in uploading status
   */
  startProcessing(): void {
    if (this.props.status !== 'uploading') {
      throw new DomainError(`Cannot start processing batch in "${this.props.status}" status`);
    }
    this.props = { ...this.props, status: 'processing' };
  }

  /**
   * Record result for one file in the batch.
   * Auto-transitions to completed/partial/failed when all files processed.
   * @param success Whether the file was processed successfully
   */
  recordFileResult(success: boolean): void {
    const processedFiles = this.props.processedFiles + 1;
    const successFiles = this.props.successFiles + (success ? 1 : 0);
    const errorFiles = this.props.errorFiles + (success ? 0 : 1);

    let status: BatchStatus = this.props.status;
    let completedAt = this.props.completedAt;

    if (processedFiles >= this.props.totalFiles) {
      completedAt = new Date();
      if (errorFiles === 0) {
        status = 'completed';
      } else if (successFiles === 0) {
        status = 'failed';
      } else {
        status = 'partial';
      }
    }

    this.props = {
      ...this.props,
      processedFiles,
      successFiles,
      errorFiles,
      status,
      completedAt,
    };
  }

  /**
   * Cancel the batch.
   * @throws DomainError if batch is already completed/failed/partial
   */
  cancel(): void {
    const terminalStatuses: BatchStatus[] = ['completed', 'partial', 'failed', 'cancelled'];
    if (terminalStatuses.includes(this.props.status)) {
      throw new DomainError(`Cannot cancel batch in "${this.props.status}" status`);
    }
    this.props = { ...this.props, status: 'cancelled', completedAt: new Date() };
  }

  /**
   * Return a plain object representation for persistence.
   * @returns BatchProps
   */
  toProps(): BatchProps {
    return { ...this.props };
  }
}
