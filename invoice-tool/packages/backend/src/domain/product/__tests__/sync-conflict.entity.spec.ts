import { SyncConflict } from '../sync-conflict.entity';
import { DomainError } from '../../shared/domain-error';

function createConflict(overrides?: Record<string, unknown>): SyncConflict {
  return SyncConflict.create({
    productId: 'prod-1',
    fieldName: 'productName',
    localValue: 'Loa Bluetooth Xiaomi Sound 30W',
    remoteValue: 'Loa Bluetooth Xiaomi Sound Outdoor 30W v2',
    ...overrides,
  });
}

describe('SyncConflict', () => {
  describe('create', () => {
    it('should create conflict with valid props', () => {
      const conflict = createConflict();
      expect(conflict.id).toBeDefined();
      expect(conflict.productId).toBe('prod-1');
      expect(conflict.fieldName).toBe('productName');
      expect(conflict.localValue).toBe('Loa Bluetooth Xiaomi Sound 30W');
      expect(conflict.remoteValue).toBe('Loa Bluetooth Xiaomi Sound Outdoor 30W v2');
      expect(conflict.resolvedAt).toBeNull();
      expect(conflict.resolvedAction).toBeNull();
    });

    it('should throw DomainError when productId is empty', () => {
      expect(() => createConflict({ productId: '' })).toThrow(DomainError);
    });

    it('should throw DomainError when fieldName is empty', () => {
      expect(() => createConflict({ fieldName: '' })).toThrow(DomainError);
    });
  });

  describe('resolveKeepLocal', () => {
    it('should resolve with keep_local action', () => {
      const conflict = createConflict();
      conflict.resolveKeepLocal();
      expect(conflict.resolvedAction).toBe('keep_local');
      expect(conflict.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw DomainError when already resolved', () => {
      const conflict = createConflict();
      conflict.resolveKeepLocal();
      expect(() => conflict.resolveKeepLocal()).toThrow(DomainError);
    });
  });

  describe('resolveAcceptRemote', () => {
    it('should resolve with accept_remote action', () => {
      const conflict = createConflict();
      conflict.resolveAcceptRemote();
      expect(conflict.resolvedAction).toBe('accept_remote');
      expect(conflict.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('reconstitute', () => {
    it('should recreate from stored props', () => {
      const conflict = SyncConflict.reconstitute({
        id: 'conflict-1',
        productId: 'prod-1',
        fieldName: 'productName',
        localValue: 'Old',
        remoteValue: 'New',
        resolvedAt: new Date(),
        resolvedAction: 'keep_local',
        createdAt: new Date(),
      });
      expect(conflict.id).toBe('conflict-1');
      expect(conflict.resolvedAction).toBe('keep_local');
    });
  });

  describe('toProps', () => {
    it('should return plain object', () => {
      const conflict = createConflict({ id: 'conflict-test' });
      const props = conflict.toProps();
      expect(props.id).toBe('conflict-test');
      expect(props.fieldName).toBe('productName');
    });
  });
});
