import { Confidence } from '../value-objects/confidence.vo';
import { DomainError } from '../domain-error';

describe('Confidence', () => {
  describe('create', () => {
    it('should create Confidence with valid value', () => {
      const conf = Confidence.create(0.85);
      expect(conf.value).toBe(0.85);
    });

    it('should create Confidence with 0', () => {
      const conf = Confidence.create(0);
      expect(conf.value).toBe(0);
    });

    it('should create Confidence with 1', () => {
      const conf = Confidence.create(1);
      expect(conf.value).toBe(1);
    });

    it('should throw DomainError for value > 1', () => {
      expect(() => Confidence.create(1.1)).toThrow(DomainError);
    });

    it('should throw DomainError for value < 0', () => {
      expect(() => Confidence.create(-0.1)).toThrow(DomainError);
    });
  });

  describe('isHigh', () => {
    it('should return true when >= 0.95 (auto-approve threshold)', () => {
      expect(Confidence.create(0.95).isHigh()).toBe(true);
      expect(Confidence.create(1.0).isHigh()).toBe(true);
    });

    it('should return false when < 0.95', () => {
      expect(Confidence.create(0.94).isHigh()).toBe(false);
    });
  });

  describe('isLow', () => {
    it('should return true when < 0.70 (force-review threshold)', () => {
      expect(Confidence.create(0.69).isLow()).toBe(true);
      expect(Confidence.create(0).isLow()).toBe(true);
    });

    it('should return false when >= 0.70', () => {
      expect(Confidence.create(0.70).isLow()).toBe(false);
    });
  });

  describe('isMedium', () => {
    it('should return true when between thresholds', () => {
      expect(Confidence.create(0.80).isMedium()).toBe(true);
      expect(Confidence.create(0.70).isMedium()).toBe(true);
      expect(Confidence.create(0.94).isMedium()).toBe(true);
    });
  });

  describe('equals', () => {
    it('should return true for same value', () => {
      const a = Confidence.create(0.85);
      const b = Confidence.create(0.85);
      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different values', () => {
      const a = Confidence.create(0.85);
      const b = Confidence.create(0.90);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should format as percentage string', () => {
      const conf = Confidence.create(0.856);
      expect(conf.toString()).toBe('85.6%');
    });
  });
});
