import { DomainError } from '../domain-error';

/**
 * Value object representing a monetary value in VND.
 * Always a non-negative integer (Vietnamese Dong has no decimals).
 * Immutable — arithmetic operations return new instances.
 */
export class Money {
  private constructor(readonly value: number) {}

  /**
   * Create a Money instance.
   * @param amount Non-negative integer amount in VND
   * @returns A validated Money instance
   * @throws DomainError if amount is negative or non-integer
   */
  static create(amount: number): Money {
    if (amount < 0) {
      throw new DomainError(`Money amount cannot be negative: ${amount}`);
    }
    if (!Number.isInteger(amount)) {
      throw new DomainError(`Money amount must be an integer (VND): ${amount}`);
    }
    return new Money(amount);
  }

  /**
   * Add another Money value.
   * @param other Money to add
   * @returns New Money with sum
   */
  add(other: Money): Money {
    return new Money(this.value + other.value);
  }

  /**
   * Subtract another Money value.
   * @param other Money to subtract
   * @returns New Money with difference
   * @throws DomainError if result would be negative
   */
  subtract(other: Money): Money {
    const result = this.value - other.value;
    if (result < 0) {
      throw new DomainError(`Money subtraction would result in negative: ${this.value} - ${other.value}`);
    }
    return new Money(result);
  }

  /**
   * Check equality by value.
   * @param other Another Money to compare
   * @returns true if both have the same amount
   */
  equals(other: Money): boolean {
    return this.value === other.value;
  }

  /**
   * Check if two Money values are within a tolerance (± VND).
   * Used for validation of totals where rounding may differ by 1 VND.
   * @param other Money to compare against
   * @param toleranceVnd Maximum allowed difference in VND
   * @returns true if within tolerance
   */
  isWithinTolerance(other: Money, toleranceVnd: number): boolean {
    return Math.abs(this.value - other.value) <= toleranceVnd;
  }

  /**
   * @returns Formatted string like "1000000 VND"
   */
  toString(): string {
    return `${this.value} VND`;
  }
}
