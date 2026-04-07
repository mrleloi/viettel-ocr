import { DomainError } from '../shared/domain-error';
import { generateId } from '../shared/identifier';
import type { SyncConflictProps } from '@invoice-tool/shared';

/** Props required to create a new SyncConflict */
export interface CreateSyncConflictProps {
  readonly id?: string;
  readonly productId: string;
  readonly fieldName: string;
  readonly localValue: string;
  readonly remoteValue: string;
}

/**
 * SyncConflict entity — records a conflict between local and remote product data.
 * Can be resolved by keeping local or accepting remote value.
 */
export class SyncConflict {
  private props: SyncConflictProps;

  private constructor(props: SyncConflictProps) {
    this.props = props;
  }

  /**
   * Create a new SyncConflict.
   * @param input Required fields for a new conflict
   * @returns A new SyncConflict instance
   * @throws DomainError if required fields are missing
   */
  static create(input: CreateSyncConflictProps): SyncConflict {
    if (!input.productId) {
      throw new DomainError('SyncConflict product ID is required');
    }
    if (!input.fieldName) {
      throw new DomainError('SyncConflict field name is required');
    }

    return new SyncConflict({
      id: input.id ?? generateId(),
      productId: input.productId,
      fieldName: input.fieldName,
      localValue: input.localValue,
      remoteValue: input.remoteValue,
      resolvedAt: null,
      resolvedAction: null,
      createdAt: new Date(),
    });
  }

  /**
   * Reconstitute a SyncConflict from stored data (skips validation).
   * @param props All conflict properties from persistence
   * @returns A SyncConflict instance
   */
  static reconstitute(props: SyncConflictProps): SyncConflict {
    return new SyncConflict({ ...props });
  }

  // --- Getters ---
  get id(): string { return this.props.id; }
  get productId(): string { return this.props.productId; }
  get fieldName(): string { return this.props.fieldName; }
  get localValue(): string { return this.props.localValue; }
  get remoteValue(): string { return this.props.remoteValue; }
  get resolvedAt(): Date | null { return this.props.resolvedAt; }
  get resolvedAction(): 'keep_local' | 'accept_remote' | null { return this.props.resolvedAction; }
  get createdAt(): Date { return this.props.createdAt; }

  // --- Resolution ---

  /**
   * Resolve conflict by keeping the local value.
   * @throws DomainError if already resolved
   */
  resolveKeepLocal(): void {
    if (this.props.resolvedAt !== null) {
      throw new DomainError('Conflict is already resolved');
    }
    this.props = {
      ...this.props,
      resolvedAction: 'keep_local',
      resolvedAt: new Date(),
    };
  }

  /**
   * Resolve conflict by accepting the remote value.
   * @throws DomainError if already resolved
   */
  resolveAcceptRemote(): void {
    if (this.props.resolvedAt !== null) {
      throw new DomainError('Conflict is already resolved');
    }
    this.props = {
      ...this.props,
      resolvedAction: 'accept_remote',
      resolvedAt: new Date(),
    };
  }

  /**
   * Return a plain object representation for persistence.
   * @returns SyncConflictProps
   */
  toProps(): SyncConflictProps {
    return { ...this.props };
  }
}
