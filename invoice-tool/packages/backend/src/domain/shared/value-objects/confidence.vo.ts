import { DomainError } from '../domain-error';
import { DEFAULT_CONFIDENCE_THRESHOLDS } from '@invoice-tool/shared';

/**
 * Value object representing a confidence score (0.0 to 1.0).
 * Provides threshold classification (high/medium/low) based on business rules.
 * Immutable and self-validating.
 */
export class Confidence {
  private constructor(readonly value: number) {}

  /**
   * Create a Confidence from a numeric value.
   * @param value Confidence score between 0.0 and 1.0
   * @returns A validated Confidence instance
   * @throws DomainError if value is out of range
   */
  static create(value: number): Confidence {
    if (value < 0 || value > 1) {
      throw new DomainError(`Confidence must be between 0 and 1, got: ${value}`);
    }
    return new Confidence(value);
  }

  /**
   * Check if confidence is high enough for auto-approval.
   * @returns true if >= autoApprove threshold (0.95)
   */
  isHigh(): boolean {
    return this.value >= DEFAULT_CONFIDENCE_THRESHOLDS.autoApprove;
  }

  /**
   * Check if confidence is too low and requires forced review.
   * @returns true if < forceReview threshold (0.70)
   */
  isLow(): boolean {
    return this.value < DEFAULT_CONFIDENCE_THRESHOLDS.forceReview;
  }

  /**
   * Check if confidence is in the medium range (needs operator review).
   * @returns true if between forceReview and autoApprove thresholds
   */
  isMedium(): boolean {
    return !this.isHigh() && !this.isLow();
  }

  /**
   * Check equality by value.
   * @param other Another Confidence to compare
   * @returns true if both have the same value
   */
  equals(other: Confidence): boolean {
    return this.value === other.value;
  }

  /**
   * @returns Formatted percentage string like "85.6%"
   */
  toString(): string {
    return `${(this.value * 100).toPrecision(3)}%`;
  }
}
