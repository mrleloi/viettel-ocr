import { TaxId } from '../value-objects/tax-id.vo';
import { DomainError } from '../domain-error';

describe('TaxId', () => {
  describe('create', () => {
    it('should create TaxId with valid 10-digit format', () => {
      const taxId = TaxId.create('0302861742');
      expect(taxId.value).toBe('0302861742');
    });

    it('should create TaxId with valid 13-digit (10-3) format', () => {
      const taxId = TaxId.create('0302861742-001');
      expect(taxId.value).toBe('0302861742-001');
    });

    it('should strip whitespace before validation', () => {
      const taxId = TaxId.create(' 0302861742 ');
      expect(taxId.value).toBe('0302861742');
    });

    it('should throw DomainError for empty string', () => {
      expect(() => TaxId.create('')).toThrow(DomainError);
    });

    it('should throw DomainError for invalid format', () => {
      expect(() => TaxId.create('ABC123')).toThrow(DomainError);
      expect(() => TaxId.create('12345')).toThrow(DomainError);
      expect(() => TaxId.create('0302861742-01')).toThrow(DomainError);
      expect(() => TaxId.create('0302861742-0001')).toThrow(DomainError);
    });
  });

  describe('equals', () => {
    it('should return true for same value', () => {
      const a = TaxId.create('0302861742');
      const b = TaxId.create('0302861742');
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different values', () => {
      const a = TaxId.create('0302861742');
      const b = TaxId.create('0302861742-001');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the string value', () => {
      const taxId = TaxId.create('0302861742');
      expect(taxId.toString()).toBe('0302861742');
    });
  });
});
