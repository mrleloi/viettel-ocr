import { Money } from '../value-objects/money.vo';
import { DomainError } from '../domain-error';

describe('Money', () => {
  describe('create', () => {
    it('should create Money with valid positive integer', () => {
      const money = Money.create(100000);
      expect(money.value).toBe(100000);
    });

    it('should create Money with zero', () => {
      const money = Money.create(0);
      expect(money.value).toBe(0);
    });

    it('should throw DomainError for negative value', () => {
      expect(() => Money.create(-1)).toThrow(DomainError);
    });

    it('should throw DomainError for non-integer value', () => {
      expect(() => Money.create(100.5)).toThrow(DomainError);
    });

    it('should handle large VND amounts', () => {
      const money = Money.create(999_999_999_999);
      expect(money.value).toBe(999_999_999_999);
    });
  });

  describe('add', () => {
    it('should add two Money values', () => {
      const a = Money.create(100000);
      const b = Money.create(50000);
      const result = a.add(b);
      expect(result.value).toBe(150000);
    });
  });

  describe('subtract', () => {
    it('should subtract Money values', () => {
      const a = Money.create(100000);
      const b = Money.create(30000);
      const result = a.subtract(b);
      expect(result.value).toBe(70000);
    });

    it('should throw DomainError when result would be negative', () => {
      const a = Money.create(100);
      const b = Money.create(200);
      expect(() => a.subtract(b)).toThrow(DomainError);
    });
  });

  describe('equals', () => {
    it('should return true for same value', () => {
      const a = Money.create(100);
      const b = Money.create(100);
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different values', () => {
      const a = Money.create(100);
      const b = Money.create(200);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('isWithinTolerance', () => {
    it('should return true when within tolerance', () => {
      const a = Money.create(100);
      const b = Money.create(101);
      expect(a.isWithinTolerance(b, 1)).toBe(true);
    });

    it('should return false when outside tolerance', () => {
      const a = Money.create(100);
      const b = Money.create(103);
      expect(a.isWithinTolerance(b, 1)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should format as VND string', () => {
      const money = Money.create(1000000);
      expect(money.toString()).toBe('1000000 VND');
    });
  });
});
