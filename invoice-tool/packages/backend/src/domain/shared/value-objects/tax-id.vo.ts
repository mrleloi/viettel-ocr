import { DomainError } from '../domain-error';
import { VIETNAM_TAX_ID_PATTERN } from '@invoice-tool/shared';

/**
 * Value object representing a Vietnamese Tax ID (MST).
 * Format: 10 digits or 10-3 digits (e.g., "0302861742" or "0302861742-001").
 * Immutable and self-validating.
 */
export class TaxId {
  private constructor(readonly value: string) {}

  /**
   * Create a TaxId from a raw string.
   * Strips whitespace and validates format.
   * @param raw The raw tax ID string
   * @returns A validated TaxId instance
   * @throws DomainError if format is invalid
   */
  static create(raw: string): TaxId {
    const cleaned = raw.replace(/\s/g, '');
    if (!VIETNAM_TAX_ID_PATTERN.test(cleaned)) {
      throw new DomainError(`Invalid tax ID format: "${raw}"`);
    }
    return new TaxId(cleaned);
  }

  /**
   * Check equality by value.
   * @param other Another TaxId to compare
   * @returns true if both have the same value
   */
  equals(other: TaxId): boolean {
    return this.value === other.value;
  }

  /**
   * @returns The tax ID string
   */
  toString(): string {
    return this.value;
  }
}
