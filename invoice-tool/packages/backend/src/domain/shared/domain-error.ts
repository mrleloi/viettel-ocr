/**
 * Base domain error for all business rule violations.
 * Used exclusively in the domain layer — no framework dependencies.
 */
export class DomainError extends Error {
  /** @param message Human-readable description of the domain rule violation */
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}
