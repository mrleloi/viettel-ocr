import { DomainError } from '../shared/domain-error';
import { generateId } from '../shared/identifier';

/** Props required to create a new ProcessingTrace */
export interface CreateTraceProps {
  readonly id?: string;
  readonly invoiceId: string;
  readonly stage: string;
  readonly status: string;
  readonly inputData?: string | null;
  readonly outputData?: string | null;
  readonly errorMessage?: string | null;
  readonly durationMs?: number | null;
}

/** All properties of a ProcessingTrace */
export interface ProcessingTraceProps {
  readonly id: string;
  readonly invoiceId: string;
  readonly stage: string;
  readonly status: string;
  readonly inputData: string | null;
  readonly outputData: string | null;
  readonly errorMessage: string | null;
  readonly durationMs: number | null;
  readonly createdAt: Date;
}

/**
 * ProcessingTrace entity — records individual pipeline stage executions.
 * Each trace captures the stage name, status, timing, and any error info.
 * Immutable once created (append-only log).
 */
export class ProcessingTrace {
  private readonly props: ProcessingTraceProps;

  private constructor(props: ProcessingTraceProps) {
    this.props = props;
  }

  /**
   * Create a new ProcessingTrace.
   * @param input - Required and optional fields for the trace
   * @returns A new ProcessingTrace instance
   * @throws DomainError if required fields are missing or invalid
   */
  static create(input: CreateTraceProps): ProcessingTrace {
    if (!input.invoiceId) {
      throw new DomainError('ProcessingTrace invoiceId is required');
    }
    if (!input.stage) {
      throw new DomainError('ProcessingTrace stage is required');
    }
    if (!input.status) {
      throw new DomainError('ProcessingTrace status is required');
    }
    if (input.durationMs != null && input.durationMs < 0) {
      throw new DomainError('ProcessingTrace durationMs must be non-negative');
    }

    return new ProcessingTrace({
      id: input.id ?? generateId(),
      invoiceId: input.invoiceId,
      stage: input.stage,
      status: input.status,
      inputData: input.inputData ?? null,
      outputData: input.outputData ?? null,
      errorMessage: input.errorMessage ?? null,
      durationMs: input.durationMs ?? null,
      createdAt: new Date(),
    });
  }

  /**
   * Reconstitute a ProcessingTrace from stored data (skips validation).
   * @param props - All trace properties from persistence
   * @returns A ProcessingTrace instance
   */
  static reconstitute(props: ProcessingTraceProps): ProcessingTrace {
    return new ProcessingTrace({ ...props });
  }

  // --- Getters ---

  /** @returns Unique trace ID */
  get id(): string { return this.props.id; }

  /** @returns Invoice ID this trace belongs to */
  get invoiceId(): string { return this.props.invoiceId; }

  /** @returns Pipeline stage name (classify, extract, validate, score, route) */
  get stage(): string { return this.props.stage; }

  /** @returns Stage execution status (completed, failed) */
  get status(): string { return this.props.status; }

  /** @returns Serialized stage input data, or null */
  get inputData(): string | null { return this.props.inputData; }

  /** @returns Serialized stage output data, or null */
  get outputData(): string | null { return this.props.outputData; }

  /** @returns Error message if stage failed, or null */
  get errorMessage(): string | null { return this.props.errorMessage; }

  /** @returns Stage duration in milliseconds, or null */
  get durationMs(): number | null { return this.props.durationMs; }

  /** @returns When this trace was created */
  get createdAt(): Date { return this.props.createdAt; }

  /**
   * Return a plain object representation for persistence.
   * @returns ProcessingTraceProps
   */
  toProps(): ProcessingTraceProps {
    return { ...this.props };
  }
}
